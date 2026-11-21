package com.hushrp.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://appassets.androidplatform.net/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> filePickerLauncher;
    private final ExecutorService httpPool = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, HttpURLConnection> activeRequests = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Boolean> cancelledRequests = new ConcurrentHashMap<>();
    private long lastBackPressMs = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        filePickerLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (filePathCallback == null) return;
                    Uri[] uris = null;
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        Intent data = result.getData();
                        if (data.getData() != null) {
                            uris = new Uri[]{data.getData()};
                        } else if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                            int count = data.getClipData().getItemCount();
                            uris = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                uris[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        }
                    }
                    filePathCallback.onReceiveValue(uris);
                    filePathCallback = null;
                }
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#12110F"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.addJavascriptInterface(new HushAndroidBridge(), "HushAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())) {
                    return assetLoader.shouldInterceptRequest(uri);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                if ("appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                } catch (Exception ignored) {
                    return false;
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    String[] accepts = params != null ? params.getAcceptTypes() : null;
                    if (accepts != null && accepts.length == 1 && accepts[0] != null && !accepts[0].isEmpty()) {
                        String mime = accepts[0];
                        intent.setType(mime.contains("/") ? mime : "*/*");
                    } else if (accepts != null && accepts.length > 1) {
                        intent.setType("*/*");
                        intent.putExtra(Intent.EXTRA_MIME_TYPES, accepts);
                    } else {
                        intent.setType("*/*");
                    }
                    filePickerLauncher.launch(intent);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView == null) {
                    finish();
                    return;
                }
                webView.evaluateJavascript(
                        "(function(){return typeof window.handleAndroidBackPress==='function'?window.handleAndroidBackPress():false;})()",
                        result -> {
                            if ("true".equals(result)) return;
                            long now = System.currentTimeMillis();
                            if (now - lastBackPressMs < 1800) {
                                finish();
                            } else {
                                lastBackPressMs = now;
                                Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT).show();
                            }
                        }
                );
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        for (HttpURLConnection conn : activeRequests.values()) {
            try { conn.disconnect(); } catch (Exception ignored) {}
        }
        activeRequests.clear();
        httpPool.shutdownNow();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void deliverNativeHttpResult(String reqId, JSONObject payload) {
        final String js = "window.__hushNativeHttpCallback && window.__hushNativeHttpCallback("
                + JSONObject.quote(reqId) + "," + JSONObject.quote(payload.toString()) + ");";
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(js, null);
            }
        });
    }

    public class HushAndroidBridge {
        @JavascriptInterface
        public String getAppVersion() {
            return "1.2.0";
        }

        @JavascriptInterface
        public void cancelHttpRequest(String reqId) {
            if (reqId == null) return;
            cancelledRequests.put(reqId, Boolean.TRUE);
            HttpURLConnection conn = activeRequests.remove(reqId);
            if (conn != null) {
                httpPool.execute(() -> {
                    try { conn.disconnect(); } catch (Exception ignored) {}
                });
            }
        }

        @JavascriptInterface
        public void httpRequestAsync(String reqId, String optionsJson) {
            httpPool.execute(() -> {
                JSONObject resObj = new JSONObject();
                HttpURLConnection conn = null;
                try {
                    JSONObject opts = new JSONObject(optionsJson);
                    String urlStr = opts.optString("url", "");
                    String method = opts.optString("method", "GET").toUpperCase();
                    int timeoutMs = Math.max(5000, Math.min(180000, opts.optInt("timeoutMs", 60000)));
                    String bodyStr = opts.isNull("body") ? null : opts.optString("body", null);
                    JSONObject headers = opts.optJSONObject("headers");

                    if (Boolean.TRUE.equals(cancelledRequests.remove(reqId))) {
                        resObj.put("aborted", true);
                        deliverNativeHttpResult(reqId, resObj);
                        return;
                    }

                    URL url = new URL(urlStr);
                    conn = (HttpURLConnection) url.openConnection();
                    activeRequests.put(reqId, conn);
                    conn.setRequestMethod(method);
                    conn.setConnectTimeout(Math.min(20000, timeoutMs));
                    conn.setReadTimeout(timeoutMs);
                    conn.setInstanceFollowRedirects(true);

                    if (headers != null) {
                        Iterator<String> keys = headers.keys();
                        while (keys.hasNext()) {
                            String k = keys.next();
                            String v = headers.optString(k, "");
                            if (!k.isEmpty() && !v.isEmpty()) {
                                conn.setRequestProperty(k, v);
                            }
                        }
                    }

                    if (bodyStr != null && ("POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method))) {
                        byte[] bytes = bodyStr.getBytes(StandardCharsets.UTF_8);
                        conn.setDoOutput(true);
                        conn.setFixedLengthStreamingMode(bytes.length);
                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(bytes);
                        }
                    }

                    int status = conn.getResponseCode();
                    InputStream is = status >= 200 && status < 400 ? conn.getInputStream() : conn.getErrorStream();
                    String respText = "";
                    if (is != null) {
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) != -1) {
                            baos.write(buf, 0, n);
                        }
                        is.close();
                        respText = baos.toString(StandardCharsets.UTF_8.name());
                    }

                    if (Boolean.TRUE.equals(cancelledRequests.remove(reqId))) {
                        resObj.put("aborted", true);
                    } else {
                        resObj.put("ok", status >= 200 && status < 300);
                        resObj.put("status", status);
                        resObj.put("text", respText);
                    }
                } catch (Exception e) {
                    try {
                        if (Boolean.TRUE.equals(cancelledRequests.remove(reqId))) {
                            resObj.put("aborted", true);
                        } else {
                            resObj.put("ok", false);
                            resObj.put("status", 0);
                            resObj.put("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                        }
                    } catch (Exception ignored) {}
                } finally {
                    activeRequests.remove(reqId);
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Exception ignored) {}
                    }
                }
                deliverNativeHttpResult(reqId, resObj);
            });
        }

        @JavascriptInterface
        public boolean saveTextFile(String filename, String mimeType, String content) {
            try {
                String cleanName = (filename == null ? "hushrp-export.txt" : filename).replaceAll("[^a-zA-Z0-9._\\-\\u0E00-\\u0E7F]", "_");
                byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, cleanName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType != null ? mimeType : "text/plain");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HushRP");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return false;
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os == null) return false;
                        os.write(bytes);
                    }
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "HushRP");
                    if (!dir.exists()) dir.mkdirs();
                    File out = new File(dir, cleanName);
                    try (FileOutputStream fos = new FileOutputStream(out)) {
                        fos.write(bytes);
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved: " + cleanName, Toast.LENGTH_SHORT).show());
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void setStatusBarColor(String hexColor, boolean isLight) {
            runOnUiThread(() -> {
                try {
                    int color = Color.parseColor(hexColor);
                    Window window = getWindow();
                    window.setStatusBarColor(color);
                    window.setNavigationBarColor(color);
                    WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
                    controller.setAppearanceLightStatusBars(isLight);
                    controller.setAppearanceLightNavigationBars(isLight);
                } catch (Exception ignored) {}
            });
        }
    }
}
