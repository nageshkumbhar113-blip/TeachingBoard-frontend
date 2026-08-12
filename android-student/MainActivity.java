package com.nkseduorbit.student;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Enables chrome://inspect remote debugging even on release builds —
    // used for automated QA/testing. Only exploitable with physical/adb
    // access to the device, which already implies full device access.
    WebView.setWebContentsDebuggingEnabled(true);

    // Real HTML5 fullscreen (the ⛶ button inside an embedded video player —
    // e.g. student-app/videoTeacherSelect.js's YouTube IFrame) needs the
    // WebView's WebChromeClient to actually implement
    // onShowCustomView/onHideCustomView. Capacitor's default
    // BridgeWebChromeClient explicitly no-ops this (it calls
    // callback.onCustomViewHidden() immediately — see
    // node_modules/@capacitor/android/.../BridgeWebChromeClient.java), so a
    // plain fullscreen request from inside the WebView silently fails
    // without this override.
    //
    // Subclassing BridgeWebChromeClient (not replacing it with a plain
    // WebChromeClient) is deliberate — it preserves every other
    // WebChromeClient behavior Capacitor plugins depend on (file-chooser
    // uploads, JS alert/confirm/prompt dialogs, camera/mic permission
    // requests, geolocation prompts, console logging) completely untouched;
    // only onShowCustomView/onHideCustomView are overridden below.
    WebView webView = getBridge().getWebView();
    if (webView != null) {
      webView.setWebChromeClient(new FullscreenWebChromeClient(getBridge()));
    }
  }

  /**
   * Adds real HTML5-Fullscreen-API support (the video's own ⛶ button) on
   * top of Capacitor's default BridgeWebChromeClient. This does NOT affect
   * "rotate to fill" — that's handled entirely in CSS/JS on the web side
   * (student-app/videoTeacherSelect.css's .vp-landscape-fill) and needs no
   * native code at all; this class only covers the in-player fullscreen
   * button, which genuinely requires WebView-level support.
   */
  private class FullscreenWebChromeClient extends BridgeWebChromeClient {
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout fullscreenContainer;
    private int originalSystemUiVisibility;

    FullscreenWebChromeClient(Bridge bridge) {
      super(bridge);
    }

    @Override
    public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
      // Already showing a custom view — WebView contract says reject the
      // new one immediately rather than silently swapping.
      if (customView != null) {
        callback.onCustomViewHidden();
        return;
      }

      customView = view;
      customViewCallback = callback;

      FrameLayout decorView = (FrameLayout) getWindow().getDecorView();

      fullscreenContainer = new FrameLayout(MainActivity.this);
      fullscreenContainer.setLayoutParams(
        new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      );
      fullscreenContainer.addView(
        customView,
        new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      );
      decorView.addView(fullscreenContainer);

      originalSystemUiVisibility = decorView.getSystemUiVisibility();
      // Deprecated in favor of WindowInsetsController (API 30+), but kept
      // here for broad compatibility with this app's existing minSdk —
      // still fully functional on every currently-supported Android
      // version, same approach used by most Capacitor/Cordova fullscreen
      // video plugins.
      decorView.setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_FULLSCREEN
          | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      );

      getBridge().getWebView().setVisibility(View.GONE);
    }

    @Override
    public void onHideCustomView() {
      if (customView == null) return;

      FrameLayout decorView = (FrameLayout) getWindow().getDecorView();
      decorView.removeView(fullscreenContainer);
      decorView.setSystemUiVisibility(originalSystemUiVisibility);

      getBridge().getWebView().setVisibility(View.VISIBLE);

      customView = null;
      fullscreenContainer = null;
      if (customViewCallback != null) {
        customViewCallback.onCustomViewHidden();
        customViewCallback = null;
      }
    }
  }
}
