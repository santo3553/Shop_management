package com.biplobshop.pos;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "CSVDownloader")
public class CSVDownloaderPlugin extends Plugin {

    @PluginMethod
    public void saveAndShareCsv(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");

        if (filename == null || content == null) {
            call.reject("Must provide filename and content");
            return;
        }

        Context context = getContext();
        if (context == null && getActivity() != null) {
            context = getActivity().getApplicationContext();
        }
        final Context finalContext = context;

        if (getActivity() == null) {
            call.reject("Activity is null");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                // 1. Write file to App Cache exports dir for FileProvider sharing
                File exportDir = new File(finalContext.getCacheDir(), "exports");
                if (!exportDir.exists()) {
                    exportDir.mkdirs();
                }
                File csvFile = new File(exportDir, filename);
                try (FileOutputStream fos = new FileOutputStream(csvFile)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                }

                // 2. Save directly to Android device public Downloads folder
                boolean savedToDownloads = saveToDownloads(finalContext, filename, content);

                // 3. Trigger native Android Share Sheet via FileProvider
                Uri contentUri = FileProvider.getUriForFile(
                    finalContext,
                    finalContext.getPackageName() + ".fileprovider",
                    csvFile
                );

                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/csv");
                intent.putExtra(Intent.EXTRA_SUBJECT, filename);
                intent.putExtra(Intent.EXTRA_TEXT, "Exported from Mobile Decor: " + filename);
                intent.putExtra(Intent.EXTRA_STREAM, contentUri);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(intent, "Share or Open CSV (" + filename + ")");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                finalContext.startActivity(chooser);

                Toast.makeText(finalContext, "CSV saved to Downloads and opened Share options!", Toast.LENGTH_SHORT).show();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("savedToDownloads", savedToDownloads);
                call.resolve(ret);
            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(finalContext, "Export error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                call.reject("Failed to export CSV: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void saveAndShareBackup(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        String caption = call.getString("caption");
        if (caption == null) caption = "Mobile Decor & Tech POS Database Backup: " + filename;

        if (filename == null || content == null) {
            call.reject("Must provide filename and content");
            return;
        }

        Context context = getContext();
        if (context == null && getActivity() != null) {
            context = getActivity().getApplicationContext();
        }
        final Context finalContext = context;

        if (getActivity() == null) {
            call.reject("Activity is null");
            return;
        }

        final String shareCaption = caption;
        getActivity().runOnUiThread(() -> {
            try {
                // 1. Write file to App Cache exports dir for FileProvider sharing
                File exportDir = new File(finalContext.getCacheDir(), "exports");
                if (!exportDir.exists()) {
                    exportDir.mkdirs();
                }
                File backupFile = new File(exportDir, filename);
                try (FileOutputStream fos = new FileOutputStream(backupFile)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                }

                // 2. Save directly to Android device public Downloads folder
                boolean savedToDownloads = saveToDownloads(finalContext, filename, content, "application/octet-stream");

                // 3. Trigger native Android Share Sheet via FileProvider
                Uri contentUri = FileProvider.getUriForFile(
                    finalContext,
                    finalContext.getPackageName() + ".fileprovider",
                    backupFile
                );

                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_SUBJECT, filename);
                intent.putExtra(Intent.EXTRA_TEXT, shareCaption);
                intent.putExtra(Intent.EXTRA_STREAM, contentUri);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(intent, "Send Backup via WhatsApp / Cloud (" + filename + ")");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                finalContext.startActivity(chooser);

                Toast.makeText(finalContext, "Database Backup saved to Downloads & opened Share Sheet!", Toast.LENGTH_SHORT).show();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("savedToDownloads", savedToDownloads);
                call.resolve(ret);
            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(finalContext, "Backup export error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                call.reject("Failed to export backup: " + e.getMessage(), e);
            }
        });
    }

    private boolean saveToDownloads(Context context, String filename, String content) {
        return saveToDownloads(context, filename, content, "text/csv");
    }

    private boolean saveToDownloads(Context context, String filename, String content, String mimeType) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            os.write(content.getBytes(StandardCharsets.UTF_8));
                            return true;
                        }
                    }
                }
            } else {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) downloadsDir.mkdirs();
                File file = new File(downloadsDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                    return true;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }
}
