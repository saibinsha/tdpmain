const Message = require('../models/Message');
const CommunityMessage = require('../models/CommunityMessage');
const Group = require('../models/Group');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/notificationService');

const activeCalls = new Map();
const activeGroupCalls = new Map();

async function getFcmTokensByUserIds(userIds) {
  const ids = (userIds || []).map((x) => String(x)).filter(Boolean);
  if (ids.length === 0) return [];

  const users = await User.find({
    _id: { $in: ids },
    fcmToken: { $exists: true, $ne: '' },
  }).select('_id fcmToken');

  return users
    .map((u) => ({ userId: String(u._id), fcmToken: String(u.fcmToken || '').trim() }))
    .filter((u) => u.fcmToken);
}

async function pushToUsers(userIds, title, body, data) {
  try {
    const tokens = await getFcmTokensByUserIds(userIds);
    if (tokens.length === 0) return;

    await Promise.all(
      tokens.map((t) =>
        sendPushNotification(t.fcmToken, title, body, {
          ...(data || {}),
          toUserId: t.userId,
        }).catch(() => null)
      )
    );
  } catch {
    // ignore push failures
  }
}

function roomForPrivate(a, b) {
  const ids = [String(a), String(b)].sort();
  return `private:${ids[0]}:${ids[1]}`;
}

function registerChatHandlers(io, socket) {
  socket.join(`user:${socket.user._id}`);

  socket.on('private:join', async ({ otherUserId }) => {
    if (!otherUserId) return;
    socket.join(roomForPrivate(socket.user._id, otherUserId));
  });

  socket.on('group:join', async ({ groupId }) => {
    if (!groupId) return;
    const group = await Group.findById(groupId).select('_id isPublic members');
    if (!group) return;

    const isMember = group.members.some((m) => String(m.user) === String(socket.user._id));
    if (!group.isPublic && !isMember && socket.user.role !== 'admin') return;

    socket.join(`group:${groupId}`);
  });

  socket.on('community:join', async () => {
    socket.join('community');
  });

  socket.on('private:send', async ({ toUserId, text, media }, cb) => {
    try {
      if (!toUserId) return cb && cb({ ok: false, message: 'toUserId required' });
      if (!text && !media) return cb && cb({ ok: false, message: 'text or media required' });

      let doc = await Message.create({
        type: 'private',
        from: socket.user._id,
        to: toUserId,
        text: text || '',
        media: media || null,
      });

      doc = await doc.populate('from', 'name membershipId profilePicture role');

      const room = roomForPrivate(socket.user._id, toUserId);
      io.to(room).emit('private:new', doc);
      io.to(`user:${toUserId}`).emit('private:new', doc);

      await pushToUsers(
        [String(toUserId)],
        socket.user?.name ? String(socket.user.name) : 'New message',
        text ? String(text) : 'Sent an attachment',
        {
          type: 'message',
          scope: 'private',
          fromUserId: String(socket.user._id),
          toUserId: String(toUserId),
          messageId: String(doc._id),
          kind: media?.resourceType ? String(media.resourceType) : 'text',
        }
      );

      cb && cb({ ok: true, message: doc });
    } catch (e) {
      cb && cb({ ok: false, message: e?.message || 'Failed to send' });
    }
  });

  socket.on('group:send', async ({ groupId, text, media }, cb) => {
    try {
      if (!groupId) return cb && cb({ ok: false, message: 'groupId required' });
      if (!text && !media) return cb && cb({ ok: false, message: 'text or media required' });

      const group = await Group.findById(groupId).select('_id name isPublic members');
      if (!group) return cb && cb({ ok: false, message: 'Group not found' });

      const isMember = group.members.some((m) => String(m.user) === String(socket.user._id));
      if (!group.isPublic && !isMember && socket.user.role !== 'admin') {
        return cb && cb({ ok: false, message: 'Forbidden' });
      }

      let doc = await Message.create({
        type: 'group',
        from: socket.user._id,
        group: groupId,
        text: text || '',
        media: media || null,
      });

      doc = await doc.populate('from', 'name membershipId profilePicture role');

      io.to(`group:${groupId}`).emit('group:new', doc);

      const memberIds = (group.members || [])
        .map((m) => String(m.user?._id || m.user))
        .filter((id) => id && id !== String(socket.user._id));

      await pushToUsers(
        memberIds,
        activeGroupNameForPush(groupId, group),
        text ? String(text) : 'Sent an attachment',
        {
          type: 'message',
          scope: 'group',
          groupId: String(groupId),
          fromUserId: String(socket.user._id),
          messageId: String(doc._id),
          kind: media?.resourceType ? String(media.resourceType) : 'text',
        }
      );

      cb && cb({ ok: true, message: doc });
    } catch (e) {
      cb && cb({ ok: false, message: e?.message || 'Failed to send' });
    }
  });

  function activeGroupNameForPush(groupId, groupDoc) {
    const name = groupDoc?.name;
    if (name) return String(name);
    return `Group`; // fallback
  }

  socket.on('community:send', async ({ text, media }, cb) => {
    try {
      if (!text && !media) return cb && cb({ ok: false, message: 'text or media required' });

      let doc = await CommunityMessage.create({
        from: socket.user._id,
        text: text || '',
        media: media || null,
      });

      doc = await doc.populate('from', 'name membershipId profilePicture role');

      io.to('community').emit('community:new', doc);

      // Community can be large; push only to users who have an fcmToken and exclude sender.
      try {
        const users = await User.find({ fcmToken: { $exists: true, $ne: '' }, _id: { $ne: socket.user._id } }).select('_id');
        const ids = users.map((u) => String(u._id));
        await pushToUsers(
          ids,
          'Community',
          text ? String(text) : 'Sent an attachment',
          {
            type: 'message',
            scope: 'community',
            fromUserId: String(socket.user._id),
            messageId: String(doc._id),
            kind: media?.resourceType ? String(media.resourceType) : 'text',
          }
        );
      } catch {
        // ignore
      }

      cb && cb({ ok: true, message: doc });
    } catch (e) {
      cb && cb({ ok: false, message: e?.message || 'Failed to send' });
    }
  });

  socket.on('call:invite', async ({ toUserId, callId, kind, autoAnswer }, cb) => {
    try {
      if (!toUserId) return cb && cb({ ok: false, message: 'toUserId required' });
      if (!callId) return cb && cb({ ok: false, message: 'callId required' });
      const k = kind === 'video' ? 'video' : 'audio';

      const isAdminCaller = String(socket.user?.role || '') === 'admin';
      const aa = isAdminCaller ? true : Boolean(autoAnswer);

      activeCalls.set(String(callId), {
        callId: String(callId),
        kind: k,
        callerId: String(socket.user._id),
        calleeId: String(toUserId),
        autoAnswer: aa,
        createdAt: Date.now(),
      });

      io.to(`user:${toUserId}`).emit('call:incoming', {
        callId: String(callId),
        kind: k,
        autoAnswer: aa,
        from: {
          _id: String(socket.user._id),
          name: socket.user.name,
          membershipId: socket.user.membershipId,
          profilePicture: socket.user.profilePicture,
          role: socket.user.role,
        },
      });

      await pushToUsers(
        [String(toUserId)],
        k === 'video' ? 'Incoming video call' : 'Incoming voice call',
        socket.user?.name ? `From ${socket.user.name}` : 'Incoming call',
        {
          type: 'call',
          scope: 'private',
          kind: k,
          callId: String(callId),
          fromUserId: String(socket.user._id),
          toUserId: String(toUserId),
          autoAnswer: aa ? '1' : '0',
          fromRole: String(socket.user?.role || ''),
        }
      );

      cb && cb({ ok: true });
    } catch (e) {
      cb && cb({ ok: false, message: e?.message || 'Failed' });
    }
  });

  socket.on('call:accept', async ({ callId }, cb) => {
    const call = activeCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    if (String(call.calleeId) !== String(socket.user._id)) return cb && cb({ ok: false, message: 'Forbidden' });

    io.to(`user:${call.callerId}`).emit('call:accepted', {
      callId: call.callId,
      kind: call.kind,
      by: {
        _id: String(socket.user._id),
        name: socket.user.name,
      },
    });
    cb && cb({ ok: true });
  });

  socket.on('call:reject', async ({ callId }, cb) => {
    const call = activeCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    if (String(call.calleeId) !== String(socket.user._id)) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${call.callerId}`).emit('call:rejected', { callId: call.callId });
    activeCalls.delete(String(callId));
    cb && cb({ ok: true });
  });

  function otherParty(call) {
    const me = String(socket.user._id);
    if (me === String(call.callerId)) return String(call.calleeId);
    if (me === String(call.calleeId)) return String(call.callerId);
    return null;
  }

  socket.on('call:offer', ({ callId, sdp }, cb) => {
    const call = activeCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    const other = otherParty(call);
    if (!other) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${other}`).emit('call:offer', { callId: call.callId, sdp });
    cb && cb({ ok: true });
  });

  socket.on('call:answer', ({ callId, sdp }, cb) => {
    const call = activeCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    const other = otherParty(call);
    if (!other) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${other}`).emit('call:answer', { callId: call.callId, sdp });
    cb && cb({ ok: true });
  });

  socket.on('call:ice', ({ callId, candidate }, cb) => {
    const call = activeCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    const other = otherParty(call);
    if (!other) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${other}`).emit('call:ice', { callId: call.callId, candidate });
    cb && cb({ ok: true });
  });

  socket.on('call:hangup', ({ callId }, cb) => {
    const call = activeCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    const other = otherParty(call);
    if (!other) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${other}`).emit('call:hangup', { callId: call.callId });
    activeCalls.delete(String(callId));
    cb && cb({ ok: true });
  });

  socket.on('groupcall:invite', async ({ groupId, callId, kind }, cb) => {
    try {
      if (!groupId) return cb && cb({ ok: false, message: 'groupId required' });
      if (!callId) return cb && cb({ ok: false, message: 'callId required' });

      const group = await Group.findById(groupId).select('_id name isPublic members');
      if (!group) return cb && cb({ ok: false, message: 'Group not found' });

      const isMember = group.members.some((m) => String(m.user) === String(socket.user._id));
      if (!group.isPublic && !isMember && socket.user.role !== 'admin') {
        return cb && cb({ ok: false, message: 'Forbidden' });
      }

      const k = kind === 'video' ? 'video' : 'audio';

      activeGroupCalls.set(String(callId), {
        callId: String(callId),
        groupId: String(groupId),
        kind: k,
        hostId: String(socket.user._id),
        participants: new Set([String(socket.user._id)]),
        createdAt: Date.now(),
      });

      io.to(`group:${groupId}`).emit('groupcall:incoming', {
        callId: String(callId),
        groupId: String(groupId),
        kind: k,
        from: {
          _id: String(socket.user._id),
          name: socket.user.name,
          membershipId: socket.user.membershipId,
          profilePicture: socket.user.profilePicture,
        },
      });

      const memberIds = (group.members || [])
        .map((m) => String(m.user?._id || m.user))
        .filter((id) => id && id !== String(socket.user._id));

      await pushToUsers(
        memberIds,
        k === 'video' ? 'Incoming group video call' : 'Incoming group voice call',
        socket.user?.name ? `From ${socket.user.name}` : 'Incoming group call',
        {
          type: 'call',
          scope: 'group',
          kind: k,
          callId: String(callId),
          groupId: String(groupId),
          fromUserId: String(socket.user._id),
        }
      );

      cb && cb({ ok: true });
    } catch (e) {
      cb && cb({ ok: false, message: e?.message || 'Failed' });
    }
  });

  socket.on('groupcall:join', async ({ callId, groupId }, cb) => {
    try {
      if (!groupId) return cb && cb({ ok: false, message: 'groupId required' });
      if (!callId) return cb && cb({ ok: false, message: 'callId required' });

      const call = activeGroupCalls.get(String(callId));
      if (!call || String(call.groupId) !== String(groupId)) {
        return cb && cb({ ok: false, message: 'Call not found' });
      }

      const group = await Group.findById(groupId).select('_id isPublic members');
      if (!group) return cb && cb({ ok: false, message: 'Group not found' });

      const isMember = group.members.some((m) => String(m.user) === String(socket.user._id));
      if (!group.isPublic && !isMember && socket.user.role !== 'admin') {
        return cb && cb({ ok: false, message: 'Forbidden' });
      }

      call.participants.add(String(socket.user._id));
      io.to(`group:${groupId}`).emit('groupcall:participant-joined', {
        callId: call.callId,
        groupId: call.groupId,
        user: {
          _id: String(socket.user._id),
          name: socket.user.name,
          membershipId: socket.user.membershipId,
          profilePicture: socket.user.profilePicture,
        },
      });

      cb && cb({ ok: true });
    } catch (e) {
      cb && cb({ ok: false, message: e?.message || 'Failed' });
    }
  });

  socket.on('groupcall:offer', ({ callId, toUserId, sdp }, cb) => {
    const call = activeGroupCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    if (!toUserId) return cb && cb({ ok: false, message: 'toUserId required' });

    const me = String(socket.user._id);
    if (!call.participants.has(me)) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${toUserId}`).emit('groupcall:offer', {
      callId: call.callId,
      groupId: call.groupId,
      fromUserId: me,
      sdp,
    });
    cb && cb({ ok: true });
  });

  socket.on('groupcall:answer', ({ callId, toUserId, sdp }, cb) => {
    const call = activeGroupCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    if (!toUserId) return cb && cb({ ok: false, message: 'toUserId required' });
    const me = String(socket.user._id);
    if (!call.participants.has(me)) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${toUserId}`).emit('groupcall:answer', {
      callId: call.callId,
      groupId: call.groupId,
      fromUserId: me,
      sdp,
    });
    cb && cb({ ok: true });
  });

  socket.on('groupcall:ice', ({ callId, toUserId, candidate }, cb) => {
    const call = activeGroupCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    if (!toUserId) return cb && cb({ ok: false, message: 'toUserId required' });
    const me = String(socket.user._id);
    if (!call.participants.has(me)) return cb && cb({ ok: false, message: 'Forbidden' });
    io.to(`user:${toUserId}`).emit('groupcall:ice', {
      callId: call.callId,
      groupId: call.groupId,
      fromUserId: me,
      candidate,
    });
    cb && cb({ ok: true });
  });

  socket.on('groupcall:leave', ({ callId, groupId }, cb) => {
    const call = activeGroupCalls.get(String(callId));
    if (!call) return cb && cb({ ok: false, message: 'Call not found' });
    if (groupId && String(groupId) !== String(call.groupId)) return cb && cb({ ok: false, message: 'Call not found' });

    const me = String(socket.user._id);
    if (!call.participants.has(me)) return cb && cb({ ok: false, message: 'Forbidden' });

    call.participants.delete(me);
    io.to(`group:${call.groupId}`).emit('groupcall:participant-left', {
      callId: call.callId,
      groupId: call.groupId,
      userId: me,
    });

    if (call.participants.size === 0) {
      activeGroupCalls.delete(String(callId));
    }

    cb && cb({ ok: true });
  });
}

module.exports = { registerChatHandlers };
