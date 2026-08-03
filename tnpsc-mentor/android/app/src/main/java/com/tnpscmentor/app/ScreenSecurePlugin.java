package com.tnpscmentor.app;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Toggles Android's FLAG_SECURE on the activity window. With the flag set the OS
 * blocks screenshots and screen recording, and shows a blank frame in the recent-
 * apps switcher - the only reliable way to stop screen capture (JS keyboard
 * hooks can't intercept the hardware/gesture screenshot on Android).
 *
 * The web layer calls enable() when a test starts and disable() when it ends, so
 * capture is blocked only on the exam screens. Window flags must be set on the UI
 * thread, hence the runOnUiThread wrapper.
 */
@CapacitorPlugin(name = "ScreenSecure")
public class ScreenSecurePlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        getActivity().runOnUiThread(() ->
            getActivity().getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        );
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getActivity().runOnUiThread(() ->
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        );
        call.resolve();
    }
}
