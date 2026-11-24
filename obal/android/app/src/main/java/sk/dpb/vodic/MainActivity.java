package sk.dpb.vodic;

import android.app.Dialog;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    // Google prihlásenie (Disk) otvára vyskakovacie okno; WebView ho bez tohto kódu zobrazí ako prázdnu stránku.
    private static String bezWv(String ua) {
        return ua == null ? null : ua.replace("; wv", "").replace(" Version/4.0", "");
    }

    // Appka nesmie siahať pod stavovú ani spodnú navigačnú lištu (Android 15+ to inak robí sám).
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final boolean tmavy = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        final int pozadie = tmavy ? Color.parseColor("#16181D") : Color.WHITE;
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().getDecorView().setBackgroundColor(pozadie);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(!tmavy);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(!tmavy);
        final View koren = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(koren, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets k = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(i.left, i.top, i.right, Math.max(i.bottom, k.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        final WebView wv = getBridge().getWebView();
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER); // žiadne „pružné“ naťahovanie na okrajoch
        final WebSettings s = wv.getSettings();
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        final String ua = bezWv(s.getUserAgentString());
        s.setUserAgentString(ua);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);

        wv.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                final WebView pv = new WebView(MainActivity.this);
                WebSettings ps = pv.getSettings();
                ps.setJavaScriptEnabled(true);
                ps.setDomStorageEnabled(true);
                ps.setJavaScriptCanOpenWindowsAutomatically(true);
                ps.setSupportMultipleWindows(true);
                ps.setUserAgentString(ua);
                CookieManager.getInstance().setAcceptThirdPartyCookies(pv, true);
                pv.setWebViewClient(new WebViewClient());

                final Dialog d = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar);
                d.setContentView(pv, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                d.setOnDismissListener(di -> { pv.stopLoading(); pv.destroy(); });
                pv.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        if (d.isShowing()) d.dismiss();
                    }
                });
                d.show();

                WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
                t.setWebView(pv);
                resultMsg.sendToTarget();
                return true;
            }
        });
    }
}
