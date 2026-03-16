package com.shannu.mytdp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private Map<String, String> lastData;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        String title = null;
        String body = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        Map<String, String> data = remoteMessage.getData();
        if (data != null && data.size() > 0) {
            lastData = data;
            if (title == null) title = data.get("title");
            if (body == null) body = data.get("body");

            String type = data.get("type");
            if (type != null && type.equals("call")) {
                if (title == null || title.trim().isEmpty()) title = "Incoming call";
                if (body == null || body.trim().isEmpty()) body = "Tap to open";
                sendNotification(title, body, true);
                return;
            }
        }

        if (title == null || title.trim().isEmpty()) title = "Notification";
        if (body == null) body = "";

        sendNotification(title, body, false);
    }

    private void sendNotification(String title, String messageBody, boolean isCall) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        if (lastData != null) {
            try {
                if (lastData.containsKey("type")) intent.putExtra("type", lastData.get("type"));
                if (lastData.containsKey("scope")) intent.putExtra("scope", lastData.get("scope"));
                if (lastData.containsKey("fromUserId")) intent.putExtra("fromUserId", lastData.get("fromUserId"));
                if (lastData.containsKey("toUserId")) intent.putExtra("toUserId", lastData.get("toUserId"));
                if (lastData.containsKey("callId")) intent.putExtra("callId", lastData.get("callId"));
                if (lastData.containsKey("kind")) intent.putExtra("kind", lastData.get("kind"));
                if (lastData.containsKey("groupId")) intent.putExtra("groupId", lastData.get("groupId"));
                if (lastData.containsKey("messageId")) intent.putExtra("messageId", lastData.get("messageId"));
                if (lastData.containsKey("autoAnswer")) intent.putExtra("autoAnswer", lastData.get("autoAnswer"));
            } catch (Exception ignored) {
            }
        }

        int flags;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        } else {
            flags = PendingIntent.FLAG_UPDATE_CURRENT;
        }

        int requestCode = (int) (System.currentTimeMillis() & 0xfffffff);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, requestCode, intent, flags);

        String channelId = isCall ? "calls_channel" : "default_channel";
        String channelName = isCall ? "Calls" : "General";

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(
                isCall ? RingtoneManager.TYPE_RINGTONE : RingtoneManager.TYPE_NOTIFICATION
        );

        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setPriority(isCall ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
                        .setCategory(isCall ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE)
                        .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int importance = isCall ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);

            try {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(isCall ? AudioAttributes.USAGE_NOTIFICATION_RINGTONE : AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                channel.setSound(defaultSoundUri, attrs);
                channel.enableVibration(true);
            } catch (Exception ignored) {
            }

            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify((int) System.currentTimeMillis(), notificationBuilder.build());
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Token syncing is handled by MainActivity injecting token into WebView via window.setFcmToken(token).
    }
}
