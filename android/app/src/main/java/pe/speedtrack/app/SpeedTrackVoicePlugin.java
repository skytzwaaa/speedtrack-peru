package pe.speedtrack.app;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "SpeedTrackVoice")
public class SpeedTrackVoicePlugin extends Plugin {
    private TextToSpeech engine;
    private boolean ready = false;
    private final List<Runnable> waiting = new ArrayList<>();
    private PluginCall speaking;
    private void withEngine(Runnable action) {
        getActivity().runOnUiThread(() -> {
            if (ready) { action.run(); return; }
            waiting.add(action);
            if (engine != null) return;
            engine = new TextToSpeech(getContext(), status -> getActivity().runOnUiThread(() -> {
                ready = true;
                if (status != TextToSpeech.SUCCESS) { engine.shutdown(); engine = null; }
                if (engine != null) engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    public void onStart(String id) {}
                    public void onDone(String id) { complete(id); }
                    public void onError(String id) { complete(id); }
                });
                for (Runnable task : new ArrayList<>(waiting)) task.run();
                waiting.clear();
            }));
        });
    }
    private void complete(String id) {
        getActivity().runOnUiThread(() -> {
            if (speaking != null && speaking.getCallbackId().equals(id)) { speaking.resolve(); speaking = null; }
        });
    }
    @PluginMethod public void available(PluginCall call) {
        withEngine(() -> {
            JSArray languages = new JSArray();
            if (engine != null) for (String lang : new String[]{"es-PE", "en-US", "qu-PE"})
                if (engine.isLanguageAvailable(Locale.forLanguageTag(lang)) >= TextToSpeech.LANG_AVAILABLE) languages.put(lang);
            JSObject result = new JSObject(); result.put("languages", languages); call.resolve(result);
        });
    }
    @PluginMethod public void speak(PluginCall call) {
        withEngine(() -> {
            Locale locale = Locale.forLanguageTag(call.getString("language", "es-PE"));
            if (engine == null || engine.isLanguageAvailable(locale) < TextToSpeech.LANG_AVAILABLE) { call.reject("voiceUnavailable"); return; }
            if (speaking != null) speaking.resolve();
            speaking = call;
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (speaking == call) { engine.stop(); complete(call.getCallbackId()); }
            }, 30000);
            engine.setLanguage(locale);
            Bundle params = new Bundle(); params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, call.getFloat("volume", 0.8f));
            if (engine.speak(call.getString("text", ""), TextToSpeech.QUEUE_FLUSH, params, call.getCallbackId()) == TextToSpeech.ERROR) complete(call.getCallbackId());
        });
    }
    @PluginMethod public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (engine != null) engine.stop();
            if (speaking != null) { speaking.resolve(); speaking = null; }
            call.resolve();
        });
    }
    @Override protected void handleOnDestroy() { if (engine != null) { engine.stop(); engine.shutdown(); } }
}
