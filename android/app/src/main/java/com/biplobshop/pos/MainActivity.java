package com.biplobshop.pos;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#312e81"));
            window.setNavigationBarColor(Color.parseColor("#0f172a"));

            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
            if (insetsController != null) {
                // False means light text/icons (white clock, battery, wifi) on dark indigo status bar
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }

            ViewCompat.setOnApplyWindowInsetsListener(window.getDecorView(), (v, windowInsets) -> {
                int topInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
                ).top;

                int bottomInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.navigationBars()
                ).bottom;

                if (topInsets > 0) {
                    float density = getResources().getDisplayMetrics().density;
                    int topDp = Math.round(topInsets / density);
                    int bottomDp = Math.round(bottomInsets / density);
                    runOnUiThread(() -> {
                        if (getBridge() != null && getBridge().getWebView() != null) {
                            String js = String.format(
                                java.util.Locale.US,
                                "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                                "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');",
                                topDp, bottomDp
                            );
                            getBridge().getWebView().evaluateJavascript(js, null);
                        }
                    });
                }
                return windowInsets;
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
