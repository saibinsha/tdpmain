package com.shannu.mytdp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILECHOOSER_RESULTCODE = 1;
    private static final int CAMERA_MIC_PERMISSION_REQUEST_CODE = 1003;

    private static final int GOOGLE_SIGN_IN_REQUEST_CODE = 9001;
    private GoogleSignInClient googleSignInClient;

    private String pendingPushJson = null;

    private static boolean isGoogleAuthUrl(Uri uri) {
        if (uri == null) return false;
        String host = uri.getHost();
        String url = uri.toString();
        if (host == null) return false;

        host = host.toLowerCase();
        if (host.equals("accounts.google.com") || host.endsWith(".google.com")) {
            return true;
        }

        return url.contains("oauth") || url.contains("/o/oauth2/") || url.contains("/accounts/");
    }

    private void initGoogleSignIn() {
        String webClientId = getString(R.string.default_web_client_id);
        if (webClientId == null) webClientId = "";

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestIdToken(webClientId)
                .build();
        googleSignInClient = GoogleSignIn.getClient(this, gso);
    }

    private void startGoogleSignIn() {
        if (googleSignInClient == null) {
            initGoogleSignIn();
        }
        if (googleSignInClient == null) return;
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

    private class WebAppBridge {
        @JavascriptInterface
        public void googleSignIn() {
            runOnUiThread(MainActivity.this::startGoogleSignIn);
        }
    }

    private boolean openInCustomTabOrBrowser(String url) {
        try {
            Uri uri = Uri.parse(url);
            CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder().build();
            customTabsIntent.launchUrl(this, uri);
            return true;
        } catch (Exception ignored) {
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
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

        capturePushFromIntent(getIntent());

        // ✅ Fullscreen
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        setContentView(R.layout.activity_main);

        // ✅ Runtime permissions (Android 6.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE,
                    Manifest.permission.MODIFY_AUDIO_SETTINGS
            }, 1001);
        }

        // ✅ Android 13+ notifications permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(new String[]{
                    Manifest.permission.POST_NOTIFICATIONS
            }, 1002);
        }

        // ✅ Check and request camera/mic permissions for WebRTC
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            
            ActivityCompat.requestPermissions(this, 
                new String[]{
                    Manifest.permission.CAMERA, 
                    Manifest.permission.RECORD_AUDIO
                }, 
                CAMERA_MIC_PERMISSION_REQUEST_CODE);
        }

        webView = findViewById(R.id.webview);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        
        // Enable WebRTC support for calling
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }
        
        // Enable camera and microphone for WebRTC
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        
        // Enable AppCache for better performance
        settings.setAppCacheEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        WebView.setWebContentsDebuggingEnabled(true);

        initGoogleSignIn();

        webView.addJavascriptInterface(new WebAppBridge(), "Android");

        // ✅ Enable cookies with persistent storage
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        
        // Enable persistent cookies for login state
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            CookieManager.getInstance().flush();
        }

        // ✅ Load website in WebView + inject FCM token
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request != null ? request.getUrl() : null;
                // Keep Google auth in WebView for native integration
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Keep Google auth in WebView for native integration
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                // Flush cookies to ensure persistence
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CookieManager.getInstance().flush();
                }

                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) return;
                    String token = task.getResult();
                    if (token == null || token.trim().isEmpty()) return;

                    String safe = token.replace("'", "\\'");
                    webView.evaluateJavascript("window.setFcmToken('" + safe + "')", null);
                });

                if (pendingPushJson != null) {
                    String js = "(function(){try{if(window.handlePushOpen){window.handlePushOpen(" + pendingPushJson + ");}}catch(e){}})();";
                    webView.evaluateJavascript(js, null);
                    pendingPushJson = null;
                }
            }
        });

        // ✅ Enable file upload (camera/file) and WebRTC
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // This grants the website's request for camera/mic access
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            request.grant(request.getResources());
                        } catch (Exception ignored) {
                        }
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

    // ✅ Handle file chooser result
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == GOOGLE_SIGN_IN_REQUEST_CODE) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                String idToken = account != null ? account.getIdToken() : null;
                if (idToken == null || idToken.trim().isEmpty()) {
                    sendGoogleSignInErrorToWeb("Missing idToken. Set default_web_client_id to your Web OAuth client ID and ensure SHA-1 is configured in Firebase.");
                } else {
                    sendGoogleIdTokenToWeb(idToken);
                }
            } catch (ApiException e) {
                sendGoogleSignInErrorToWeb("Google sign-in failed: " + e.getStatusCode());
            } catch (Exception e) {
                sendGoogleSignInErrorToWeb("Google sign-in failed");
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

    // ✅ WebView back button handling
    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Flush cookies before destroying to save login state
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().flush();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Save cookies when app goes to background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().flush();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Save cookies when app stops
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().flush();
        }
    }

    // ✅ WebView back button handling
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
