package com.tnpscmentor.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our local plugins before the bridge initializes so the web
        // layer can call them. (Node-module Capacitor plugins are auto-loaded;
        // app-local ones must be registered explicitly.)
        registerPlugin(ScreenSecurePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
