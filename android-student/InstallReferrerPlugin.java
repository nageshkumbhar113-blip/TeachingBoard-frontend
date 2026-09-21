package com.nkseduorbit.student;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads the Google Play "install referrer" - the value after "referrer=" in the Play Store link a
 * share link sent the person to (get-app.html adds ref%3DCODE or teacher%3DCODE). The web app uses it
 * on the first launch to fill in the teacher / friend code, so nobody has to type it.
 *
 * It never rejects: on a device without Google Play (smart boards, some phones) or on any error it
 * resolves with an empty referrer, so the app simply behaves as before.
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

  @PluginMethod
  public void getReferrer(final PluginCall call) {
    final JSObject empty = new JSObject();
    empty.put("referrer", "");
    try {
      final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
      client.startConnection(new InstallReferrerStateListener() {
        @Override
        public void onInstallReferrerSetupFinished(int responseCode) {
          try {
            if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
              ReferrerDetails details = client.getInstallReferrer();
              JSObject result = new JSObject();
              result.put("referrer", details.getInstallReferrer() == null ? "" : details.getInstallReferrer());
              result.put("clickTimestamp", details.getReferrerClickTimestampSeconds());
              result.put("installTimestamp", details.getInstallBeginTimestampSeconds());
              call.resolve(result);
            } else {
              // FEATURE_NOT_SUPPORTED / SERVICE_UNAVAILABLE: nothing to read on this device
              JSObject result = new JSObject();
              result.put("referrer", "");
              result.put("responseCode", responseCode);
              call.resolve(result);
            }
          } catch (Exception e) {
            call.resolve(empty);
          } finally {
            try { client.endConnection(); } catch (Exception ignored) { }
          }
        }

        @Override
        public void onInstallReferrerServiceDisconnected() {
          // nothing to do: the call was already answered in onInstallReferrerSetupFinished
        }
      });
    } catch (Exception e) {
      call.resolve(empty);
    }
  }
}
