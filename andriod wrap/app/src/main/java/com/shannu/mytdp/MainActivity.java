package com.shannu.mytdp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import androidx.browser.customtabs.CustomTabsIntent;

import com.google.firebase.messaging.FirebaseMessaging;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILECHOOSER_RESULTCODE = 1;
    private static final int PERMISSIONS_REQUEST_CODE = 1001;

    private static final int GOOGLE_SIGN_IN_REQUEST_CODE = 9001;
    private GoogleSignInClient googleSignInClient;

    private String pendingPushJson = null;

    private void checkAndRequestPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();
        
        permissionsNeeded.add(Manifest.permission.CAMERA);
        permissionsNeeded.add(Manifest.permission.RECORD_AUDIO);
        permissionsNeeded.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
            permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
            permissionsNeeded.add(Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        List<String> listPermissionsNeeded = new ArrayList<>();
        for (String p : permissionsNeeded) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                listPermissionsNeeded.add(p);
            }
        }

        if (!listPermissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, listPermissionsNeeded.toArray(new String[0]), PERMISSIONS_REQUEST_CODE);
        }
    }

    private void initGoogleSignIn() {
        try {
            int resId = getResources().getIdentifier("default_web_client_id", "string", getPackageName());
            String webClientId = "";
            if (resId != 0) {
                webClientId = getString(resId);
            }

            Log.d(TAG, "Configuring Google Sign-In with ID: " + webClientId);

            if (webClientId == null || webClientId.trim().isEmpty() || webClientId.contains("placeholder") || webClientId.contains("YOUR_REAL_ID")) {
                Log.w(TAG, "Google Sign-In web client ID is invalid or not configured.");
                googleSignInClient = null;
                return;
            }

            // Try to get client ID from google-services.json as fallback
            if (webClientId.contains("9ckbl2b83fguncd8t98cvpqspkisni98")) {
                Log.i(TAG, "Using configured Google client ID");
            }

            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .requestIdToken(webClientId)
                    .build();
            googleSignInClient = GoogleSignIn.getClient(this, gso);
            Log.i(TAG, "Google Sign-In initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Google Sign-In", e);
            googleSignInClient = null;
        }
    }

    private void startGoogleSignIn() {
        if (googleSignInClient == null) {
            initGoogleSignIn();
        }
        if (googleSignInClient == null) {
            sendGoogleSignInErrorToWeb("Google Sign-In configuration error. Please check your Web Client ID in strings.xml.");
            return;
        }
        Intent signInIntent = googleSignInClient.getSignInIntent();
        startActivityForResult(signInIntent, GOOGLE_SIGN_IN_REQUEST_CODE);
    }

    private void sendGoogleIdTokenToWeb(String idToken) {
        if (webView == null) return;
        if (idToken == null) idToken = "";
        String safe = escapeJs(idToken);
        String js = "(function(){try{if(window.onNativeGoogleSignIn){window.onNativeGoogleSignIn(\"" + safe + "\");}}catch(e){}})();";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void sendGoogleSignInErrorToWeb(String message) {
        if (webView == null) return;
        if (message == null) message = "";
        String safe = escapeJs(message);
        String js = "(function(){try{if(window.onNativeGoogleSignInError){window.onNativeGoogleSignInError(\"" + safe + "\");}}catch(e){}})();";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private String getGoogleSignInErrorMessage(int statusCode) {
        switch (statusCode) {
            case 10:
                return "DEVELOPER_ERROR: Google OAuth configuration issue. Check your Web Client ID and SHA-1 fingerprint in Firebase Console.";
            case 7:
                return "NETWORK_ERROR: Check your internet connection and try again.";
            case 8:
                return "INTERNAL_ERROR: Please try again later.";
            case 12501:
                return "Google Play Services not installed or outdated.";
            case 4:
                return "SIGN_IN_REQUIRED: User needs to sign in to Google account first.";
            case 5:
                return "INVALID_ACCOUNT: Invalid Google account.";
            default:
                return "Google sign-in failed (Error " + statusCode + "). Check configuration and try again.";
        }
    }

    private class WebAppBridge {
        @JavascriptInterface
        public void googleSignIn() {
            runOnUiThread(MainActivity.this::startGoogleSignIn);
        }

        @JavascriptInterface
        public void startCall() {
            runOnUiThread(() -> {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                    audioManager.setSpeakerphoneOn(true);
                    Log.i(TAG, "Call started - audio mode set to communication");
                }
            });
        }

        @JavascriptInterface
        public void startAudioCall() {
            runOnUiThread(() -> {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    // Specific settings for audio-only calls
                    audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                    audioManager.setSpeakerphoneOn(false); // Use earpiece by default for audio calls
                    audioManager.setMicrophoneMute(false);
                    Log.i(TAG, "Audio call started - optimized for voice");
                }
            });
        }

        @JavascriptInterface
        public void endCall() {
            runOnUiThread(() -> {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    audioManager.setMode(AudioManager.MODE_NORMAL);
                    audioManager.setSpeakerphoneOn(false);
                    Log.i(TAG, "Call ended - normal audio mode restored");
                }
            });
        }

        @JavascriptInterface
        public void enableSpeakerphone() {
            runOnUiThread(() -> {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    audioManager.setSpeakerphoneOn(true);
                    Log.i(TAG, "Speakerphone enabled");
                }
            });
        }

        @JavascriptInterface
        public void disableSpeakerphone() {
            runOnUiThread(() -> {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    audioManager.setSpeakerphoneOn(false);
                    Log.i(TAG, "Speakerphone disabled");
                }
            });
        }

        @JavascriptInterface
        public void getCurrentTime() {
            // This method can be called from JavaScript to get current timestamp for call timing
            long currentTime = System.currentTimeMillis();
            Log.d(TAG, "Call timer requested: " + currentTime);
        }

        @JavascriptInterface
        public void logCallEvent(String event) {
            Log.i(TAG, "Call event: " + event);
        }
    }

    private static String escapeJs(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private void capturePushFromIntent(Intent intent) {
        if (intent == null) return;
        try {
            String type = intent.getStringExtra("type");
            String scope = intent.getStringExtra("scope");
            String fromUserId = intent.getStringExtra("fromUserId");
            String toUserId = intent.getStringExtra("toUserId");
            String callId = intent.getStringExtra("callId");
            String kind = intent.getStringExtra("kind");
            String groupId = intent.getStringExtra("groupId");
            String messageId = intent.getStringExtra("messageId");
            String autoAnswer = intent.getStringExtra("autoAnswer");

            if (type == null && callId == null && fromUserId == null && messageId == null && groupId == null) {
                return;
            }

            pendingPushJson = "{" +
                    "\"type\":\"" + escapeJs(type) + "\"," +
                    "\"scope\":\"" + escapeJs(scope) + "\"," +
                    "\"fromUserId\":\"" + escapeJs(fromUserId) + "\"," +
                    "\"toUserId\":\"" + escapeJs(toUserId) + "\"," +
                    "\"callId\":\"" + escapeJs(callId) + "\"," +
                    "\"kind\":\"" + escapeJs(kind) + "\"," +
                    "\"groupId\":\"" + escapeJs(groupId) + "\"," +
                    "\"messageId\":\"" + escapeJs(messageId) + "\"," +
                    "\"autoAnswer\":\"" + escapeJs(autoAnswer) + "\"" +
                    "}";
        } catch (Exception ignored) {
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            capturePushFromIntent(getIntent());

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN |
                                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                );
            }

            setContentView(R.layout.activity_main);

            checkAndRequestPermissions();

            webView = findViewById(R.id.webview);
            if (webView == null) {
                Log.e(TAG, "WebView not found in layout!");
                return;
            }

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDatabaseEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setSupportZoom(true);
            settings.setBuiltInZoomControls(true);
            settings.setDisplayZoomControls(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }

            // Standardize User Agent to ensure full features on some websites
            String userAgent = settings.getUserAgentString();
            if (userAgent != null) {
                settings.setUserAgentString(userAgent.replace("wv", ""));
            }

            WebView.setWebContentsDebuggingEnabled(true);

            initGoogleSignIn();

            webView.addJavascriptInterface(new WebAppBridge(), "Android");

            CookieManager.getInstance().setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
                CookieManager.getInstance().flush();
            }

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return false;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return false;
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        CookieManager.getInstance().flush();
                    }

                    try {
                        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                            if (!task.isSuccessful()) return;
                            String token = task.getResult();
                            if (token == null || token.trim().isEmpty()) return;

                            String safe = token.replace("'", "\\'");
                            webView.evaluateJavascript("window.setFcmToken('" + safe + "')", null);
                        });
                    } catch (Exception e) {
                        Log.e(TAG, "Error getting FCM token", e);
                    }

                    if (pendingPushJson != null) {
                        String js = "(function(){try{if(window.handlePushOpen){window.handlePushOpen(" + pendingPushJson + ");}}catch(e){}})();";
                        webView.evaluateJavascript(js, null);
                        pendingPushJson = null;
                    }
                }
            });

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        try {
                            String[] resources = request.getResources();
                            request.grant(resources);
                            
                            // Optimization for audio calls
                            boolean hasAudioPermission = false;
                            for (String resource : resources) {
                                if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                                    hasAudioPermission = true;
                                    break;
                                }
                            }
                            
                            if (hasAudioPermission) {
                                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                                if (audioManager != null) {
                                    audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                                    audioManager.setMicrophoneMute(false);
                                    Log.i(TAG, "Audio permission granted - communication mode set");
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Permission request failed", e);
                        }
                    });
                }

                @Override
                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                    MainActivity.this.filePathCallback = filePathCallback;
                    Intent intent = fileChooserParams.createIntent();
                    try {
                        startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                    } catch (Exception e) {
                        MainActivity.this.filePathCallback = null;
                        return false;
                    }
                    return true;
                }
            });

            webView.loadUrl("https://telugudeshamparty.onrender.com/");
        } catch (Exception e) {
            Log.e(TAG, "Critical error in onCreate", e);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        capturePushFromIntent(intent);
        if (webView != null) {
            webView.post(() -> {
                if (pendingPushJson == null) return;
                String js = "(function(){try{if(window.handlePushOpen){window.handlePushOpen(" + pendingPushJson + ");}}catch(e){}})();";
                webView.evaluateJavascript(js, null);
                pendingPushJson = null;
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == GOOGLE_SIGN_IN_REQUEST_CODE) {
            try {
                Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
                GoogleSignInAccount account = task.getResult(ApiException.class);
                String idToken = account != null ? account.getIdToken() : null;
                if (idToken == null || idToken.trim().isEmpty()) {
                    sendGoogleSignInErrorToWeb("Missing idToken from Google.");
                } else {
                    sendGoogleIdTokenToWeb(idToken);
                    Log.i(TAG, "Google Sign-In successful");
                }
            } catch (ApiException e) {
                Log.e(TAG, "Google Sign-In ApiException: " + e.getStatusCode(), e);
                String errorMessage = getGoogleSignInErrorMessage(e.getStatusCode());
                sendGoogleSignInErrorToWeb(errorMessage);
            } catch (Exception e) {
                Log.e(TAG, "Google Sign-In failed", e);
                sendGoogleSignInErrorToWeb("Google sign-in failed. Check internet and Firebase configuration.");
            }
            return;
        }

        if (requestCode == FILECHOOSER_RESULTCODE && filePathCallback != null) {
            Uri[] result = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri dataUri = data.getData();
                if (dataUri != null) {
                    result = new Uri[]{dataUri};
                }
            }
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            audioManager.setMode(AudioManager.MODE_NORMAL);
        } catch (Exception ignored) {}
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().flush();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
