package com.nkseduorbit.student;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Google Play In-App Review: Google's own small sheet (stars + comment) that posts straight to the
 * Play Store listing. Google decides whether it actually appears (it has its own quota) and never
 * tells the app what the person did, so this always resolves { shown } and never rejects.
 * Asked from student-app/appReview.js after a good result — never stars-first, never with a reward.
 */
@CapacitorPlugin(name = "InAppReview")
public class InAppReviewPlugin extends Plugin {

  @PluginMethod
  public void request(final PluginCall call) {
    final JSObject out = new JSObject();
    out.put("shown", false);
    try {
      final ReviewManager manager = ReviewManagerFactory.create(getContext());
      manager.requestReviewFlow().addOnCompleteListener(task -> {
        if (!task.isSuccessful() || getActivity() == null) {
          call.resolve(out);
          return;
        }
        ReviewInfo info = task.getResult();
        manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(done -> {
          out.put("shown", true);
          call.resolve(out);
        });
      });
    } catch (Exception e) {
      call.resolve(out);
    }
  }
}
