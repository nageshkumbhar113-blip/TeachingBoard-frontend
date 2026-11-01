package com.nkseduorbit.student;

import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest;
import com.google.android.gms.auth.api.identity.Identity;

/**
 * Google "Phone Number Hint": a small system sheet that shows the phone's own SIM number(s); the
 * person taps one and the app gets only that number. No permission is needed (this is what Play
 * expects instead of reading the number). Used for the parent's mobile in the free part
 * (student-app/guest.js) and on the registration form.
 *
 * It never rejects: no Google Play services, no SIM, or the sheet closed → resolves { phone: "" },
 * and the person simply types the number as before.
 */
@CapacitorPlugin(name = "PhoneHint")
public class PhoneHintPlugin extends Plugin {

  private ActivityResultLauncher<IntentSenderRequest> launcher;
  private PluginCall pending;

  @Override
  public void load() {
    launcher = getActivity().registerForActivityResult(
      new ActivityResultContracts.StartIntentSenderForResult(),
      result -> {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("phone", "");
        try {
          if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String phone = Identity.getSignInClient(getActivity()).getPhoneNumberFromIntent(result.getData());
            out.put("phone", phone == null ? "" : phone);
          }
        } catch (Exception ignored) { }
        call.resolve(out);
      }
    );
  }

  @PluginMethod
  public void pick(final PluginCall call) {
    final JSObject empty = new JSObject();
    empty.put("phone", "");
    if (pending != null || launcher == null) {
      call.resolve(empty);
      return;
    }
    try {
      GetPhoneNumberHintIntentRequest request = GetPhoneNumberHintIntentRequest.builder().build();
      Identity.getSignInClient(getActivity())
        .getPhoneNumberHintIntent(request)
        .addOnSuccessListener(pendingIntent -> {
          try {
            pending = call;
            launcher.launch(new IntentSenderRequest.Builder(pendingIntent).build());
          } catch (Exception e) {
            pending = null;
            call.resolve(empty);
          }
        })
        .addOnFailureListener(e -> call.resolve(empty));
    } catch (Exception e) {
      call.resolve(empty);
    }
  }
}
