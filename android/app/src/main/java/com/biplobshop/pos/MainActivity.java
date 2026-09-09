package com.biplobshop.pos;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    public class AndroidCSVBridge {
        private final Context mContext;

        public AndroidCSVBridge(Context context) {
            this.mContext = context;
        }

        @JavascriptInterface
        public void saveAndShareCsv(String filename, String content) {
            runOnUiThread(() -> {
                try {
                    // 1. Write file to App Cache exports dir for FileProvider
                    File exportDir = new File(mContext.getCacheDir(), "exports");
                    if (!exportDir.exists()) {
                        exportDir.mkdirs();
                    }
                    File csvFile = new File(exportDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(csvFile)) {
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                    }

                    // 2. Save directly to device public Downloads folder
                    saveToDownloadsFolder(filename, content);

                    // 3. Trigger native Android Share Sheet via FileProvider
                    Uri contentUri = FileProvider.getUriForFile(
                        mContext,
                        mContext.getPackageName() + ".fileprovider",
                        csvFile
                    );

                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("text/csv");
                    intent.putExtra(Intent.EXTRA_SUBJECT, filename);
                    intent.putExtra(Intent.EXTRA_TEXT, "Exported from Mobile Decor & Tech: " + filename);
                    intent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                    Intent chooser = Intent.createChooser(intent, "Share or Open CSV (" + filename + ")");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    mContext.startActivity(chooser);

                    Toast.makeText(mContext, "CSV saved to Downloads & opened Share options!", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(mContext, "Export error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        private void saveToDownloadsFolder(String filename, String content) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "text/csv");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = mContext.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = mContext.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(content.getBytes(StandardCharsets.UTF_8));
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) downloadsDir.mkdirs();
                    File file = new File(downloadsDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

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

            setupWebViewBridge();

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
                            setupWebViewBridge();
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

    @Override
    public void onStart() {
        super.onStart();
        setupWebViewBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupWebViewBridge();
    }

    private void setupWebViewBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView wv = getBridge().getWebView();
                wv.addJavascriptInterface(new AndroidCSVBridge(this), "AndroidCSVBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
