package pe.speedtrack.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpeedTrackVoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
