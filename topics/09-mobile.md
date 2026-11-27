# Mobile testing, Appium, Detox and Maestro

How to study this file: read the "Say" lines out loud until they sound like you, then read "Full process" once so you can type or draw the steps. Section 1 is general mobile testing (asked more often), section 2 is Appium and the other tools. Where you have not used a tool, say so plainly and then show you know how it works.

## Fundamentals of mobile testing

### What is the difference between native, hybrid and mobile web apps, and how does that change testing?

Topic: mobile-general | Standard | id: q0841

**Say:** A native app is built for one platform with its own SDK, Swift or Kotlin, and it is installed from a store. A hybrid app is a web view wrapped in a native shell, so part of the screen is HTML and part is native. Mobile web is just a website in the phone's browser, with no install. For testing it changes the tool and the layer. Mobile web I can drive with Playwright device emulation or Appium with a mobile browser. Native needs Appium, or the platform's own tools, and I test install, permissions, lifecycle and store behaviour that a website does not have. Hybrid is the hardest, because I switch between a native context and a web view context in the same test.

**Full process:** Deciding the approach for a given app.
1. Ask what the app is built with. Native Swift or Kotlin, React Native, Flutter, or a web view shell. Ask the developers, or open the app in Appium Inspector and look at the element tree. A web view shows up as one container that holds a DOM.
2. Mobile web: use Playwright with a device descriptor (for example `devices['iPhone 13']` in a project in `playwright.config.ts`) for fast checks, and a real device or a real iOS Simulator for anything that depends on the real Safari engine.
3. Native: use Appium with the UiAutomator2 driver (Android) and the XCUITest driver (iOS), or Detox or Maestro if the team picked them.
4. Hybrid: in Appium, list contexts, switch to the web view context, run web locators, then switch back. In WebdriverIO: `await driver.getContexts()` then `await driver.switchContext('WEBVIEW_...')` and later `await driver.switchContext('NATIVE_APP')`.
5. Add what only apps have: install, first launch, permissions, backgrounding, push, deep links, update over an old version.

**Follow-ups:**
- *Which is hardest to automate?* Hybrid, because there are two element trees and the web view has to be debuggable (on Android the app must allow web view debugging).
- *Can Playwright test a native app?* No. Playwright drives browsers. Emulating a phone in Playwright tests the mobile web layout, not the native app.

**Trap:** Saying "mobile testing is web testing on a small screen". It ignores the install, lifecycle, permission, network and store layers, which is where most mobile-only bugs live.

**Source:** https://playwright.dev/docs/emulation

### What do you test differently on iOS and on Android?

Topic: mobile-general | Standard | id: q0842

**Say:** The big differences are in the platform rules, not in the feature. Android has the system back button and many device makers with their own battery savers and skins, so fragmentation is the main risk. iOS has fewer devices but stricter rules: permission prompts that appear once, background limits, and a review process before release. Permissions differ in flow. Push goes through APNs on iOS and FCM on Android. Deep links are universal links on iOS and App Links on Android. So I run the same scenarios on both, and I add platform-specific checks: Android back button, share sheet and app switching, iOS gestures, permission re-prompt behaviour and Face ID prompts.

**Full process:** A comparison I keep as a checklist per release.
1. Navigation: Android has a system back button or gesture, and the app must handle it in every screen and every dialog. iOS has a swipe-back gesture and no system back button.
2. Permissions: both ask at runtime (Android 6.0 and later for dangerous permissions). On iOS, once the user denies, the app cannot show the system prompt again, so the app must send the user to Settings. Test denial, then re-enabling in Settings, then returning to the app.
3. Push: different services and different opt-in. Test with the permission granted, denied and revoked later.
4. Links: custom scheme, universal link (iOS) and App Link (Android, verified against the site). Test with the app installed and not installed.
5. Fragmentation: Android has many vendors, screen sizes and OS versions. iOS is limited to the current and a few older versions, but notch, Dynamic Island and iPad layouts still matter.
6. Release: TestFlight and App Store review for iOS, Play Console tracks for Android.

**Follow-ups:**
- *Which platform has more bugs?* It depends on the app. In experience the bugs on Android cluster by device and OS version, and on iOS by OS version and permission states. I would not claim a ratio without data.
- *Can you write one test for both?* Yes, if the app exposes the same accessibility identifiers on both. See the cross-platform entry below.

**Trap:** Listing hardware differences only ("different screen sizes"). The interviewer wants behaviour: permissions, back navigation, background limits, push and links.

**Source:** https://developer.android.com/training/permissions/requesting

### Emulators, simulators or real devices: how do you decide?

Topic: mobile-general | Standard | id: q0843

**Say:** I use all three for different jobs. Emulators and simulators are fast, free and easy to reset, so I use them for development checks and automated runs in CI. Real devices are needed for things the virtual device cannot show honestly: real performance, battery, camera, push on the real service, Bluetooth, biometrics, vendor skins and the real network. Before a release I run a smaller set on a few real devices. One detail for the interview: an Android emulator runs a real Android image, while an iOS simulator runs the app compiled for the Mac, not on iPhone hardware, so it is not the same as a device.

**Full process:** The decision I apply.
1. Daily and CI runs: emulator or simulator. Create a fresh virtual device, run the suite, throw it away.
2. Behaviour that depends on hardware or the real service: real device. Push through the real service, camera and QR scan, biometrics, performance, thermal and battery behaviour, GPS accuracy.
3. Vendor-specific Android bugs: real devices from the vendors in the matrix (for example Samsung), because skins change permission dialogs and battery saving.
4. Release gate: a short smoke set on real devices (one older, one current iPhone, one low-end and one popular Android).
5. When a bug reproduces only on a device, collect the device model, OS version, build number and logs before closing it.

**Follow-ups:**
- *Do you need a lab?* Not always. A small set of owned devices plus a device farm for coverage works for most teams.
- *What can you simulate on an Android emulator?* Calls and SMS, location, network speed, rotation and sensors (the Android Studio docs list these), but not real hardware behaviour.

**Trap:** "Emulators are enough" or "only real devices count". The senior answer is a layered split by risk and cost.

**Source:** https://developer.android.com/studio/run/emulator

### How do you choose which devices and OS versions to test on?

Topic: mobile-general | Standard | id: q0844

**Say:** I start from data, not from my own phone. I look at the analytics of the app: which devices, OS versions and screen sizes real users have. Then I cover the top ones, plus the edges: the oldest supported OS, the newest OS, the smallest screen, a tablet or large screen, and one low-end Android. I put them in tiers: a small set for every build, a wider set for release, and the rest through a device farm or sampled. I review the matrix every quarter, because the market moves.

**Full process:** Building a device matrix.
1. Pull usage numbers from the app's analytics (for example the top 10 device models and OS versions by active users).
2. Read the minimum supported OS from the product requirements, and decide the lowest version you test on.
3. Select tier 1 (every merge, virtual devices): latest iOS on a current iPhone, latest Android on a Pixel emulator.
4. Select tier 2 (every release candidate, real devices): top 3 to 5 devices by share, one small-screen phone, one low-end Android, one tablet if supported, the oldest supported OS on each platform.
5. Select tier 3 (monthly or by risk, farm): long-tail devices, vendor skins, foldables.
6. Write the matrix in a table with the reason for each device, so the next person can change it by data.

**Follow-ups:**
- *What if there is no analytics?* Use public market share for the country and the app's support tickets as a proxy, and add analytics as a request.
- *How often do you update it?* On each major OS release and at least quarterly.

**Trap:** "Test on as many devices as possible". That is not a plan. The answer needs data, tiers and a reason for each device.

**Source:** https://developer.android.com/studio/run/emulator

### What interruptions and mobile-specific scenarios do you test?

Topic: mobile-general | Standard | id: q0845

**Say:** Mobile apps live in a hostile environment, so I test what the phone does to the app. Incoming call or notification during a flow, switching to another app and back, screen lock, low battery mode, rotation, losing the network mid-request, a permission being revoked in Settings while the app is in the background, and the system killing the app in the background. For every one of them I ask the same question: when the user comes back, is the state correct, is any data lost, and is any request sent twice?

**Full process:** A checklist per critical flow (for example checkout or sending a message).
1. Start the flow, put the app in the background (home button or app switcher), wait 30 seconds, return. Expect the same screen and the same data.
2. Start the flow, lock the screen, unlock. Expect no session loss unless the product says so.
3. Start a payment or submit, switch the network off (airplane mode) before the response. Expect a clear error, no duplicate, and a safe retry.
4. Receive a call or a notification, open it, then return. Expect the flow to resume.
5. Revoke the permission in system Settings while the app is open in the background. Return. Expect graceful handling, not a crash.
6. Rotate the device and change the font size and dark mode. Expect no cut-off text or lost input.
7. Kill the app from the switcher in the middle of the flow, reopen. Expect the app to restore sensibly or restart cleanly.
8. Record the result on both platforms, because the system behaviour differs.

**Follow-ups:**
- *How do you automate interruptions?* Appium can send the app to the background and bring it back (for example `driver.background` style commands, or the `mobile: backgroundApp` method on iOS) and toggle connectivity on Android (`mobile: setConnectivity`). Calls and real push I keep manual.
- *Which one finds the most bugs?* Network loss mid-request, because duplicates and silent data loss hide there.

**Trap:** Only testing the happy path on a fast Wi-Fi connection.

**Source:** https://github.com/appium/appium-uiautomator2-driver/blob/master/README.md

### How do you test app permissions (camera, location, notifications)?

Topic: mobile-general | Standard | id: q0846

**Say:** For each permission I test four states: not asked yet, granted, denied, and revoked later in Settings. I check that the app asks in context, that is, when the user starts the feature, and not at launch. If the user denies, the feature must degrade gracefully and the app must explain how to enable it. On iOS the app cannot ask again after a denial, so there must be a path to Settings. For automation, I grant or reset permissions through the driver, so the test does not click the system dialog every time.

**Full process:** Test matrix for one permission, for example location.
1. Fresh install, no permission yet. Open the feature. Expect the explanation and the system prompt at that moment, not at launch.
2. Tap Allow. Expect the feature to work. Tap Allow only while using the app (where the platform has it). Expect the feature to work in the foreground only.
3. Reinstall, tap Don't allow. Expect a clear message and no crash. Expect the rest of the app to work.
4. Go to system Settings, switch the permission on, return. Expect the app to notice without a restart or after a documented refresh.
5. With the permission granted, revoke it in Settings and return. Expect graceful handling.
6. Automation on Android with Appium: set the capability `appium:autoGrantPermissions: true` to grant at session start, or call `await driver.executeScript('mobile: changePermissions', [{ permissions: ['android.permission.ACCESS_FINE_LOCATION'], action: 'revoke' }])` to revoke.
7. Automation on iOS with XCUITest driver: `appium:autoAcceptAlerts: true` accepts alerts as they appear, including privacy prompts. Use it only in tests that are not about the prompt itself.

**Follow-ups:**
- *Why not auto-accept everywhere?* It hides the very behaviour you want to test, the prompt wording and the denial path. Use auto-accept for unrelated flows only.
- *What is special on Android 13 and later?* Posting notifications also needs a runtime permission, so the notification test has a granted and a denied branch.

**Trap:** Testing only "Allow". The bugs are in Deny and in revoke.

**Source:** https://developer.android.com/training/permissions/requesting

### How do you test push notifications?

Topic: mobile-general | Standard | id: q0847

**Say:** Push has three parts: the backend that sends, the push service (APNs on iOS, FCM on Android) and the app that receives it. I test all three states of the app: foreground, background and killed. I check that the notification arrives, that the text and deep link are right, that tapping it opens the correct screen, and that the permission off state sends nothing visible. I test push on real iOS and Android devices, because a simulator does not go through the real service. For automation, Appium can simulate delivery on an iOS simulator, and I can open the notification drawer on Android.

**Full process:**
1. Preconditions: build with push enabled, a test account, notification permission granted, the device online, a staging backend that can send a push to that account.
2. Trigger a push from the backend (a staging admin action, an API call or the provider's test message tool).
3. Foreground: expect the in-app behaviour the product defines (banner or silent).
4. Background: expect a system notification. Tap it. Expect the right screen and data.
5. Killed: swipe the app away, send the push again, tap it. Expect a cold start into the right screen.
6. Negative: permission denied, user logged out, user switched account, notifications turned off for the channel. Expect no leak of another user's content.
7. Automation: on an iOS simulator, `await driver.executeScript('mobile: pushNotification', [{ bundleId: 'com.example.app', payload: { aps: { alert: { title: 'Test' }, badge: 1 } } }])`. On Android, `await driver.executeScript('mobile: openNotifications', [])` and then locate the notification. Real delivery through FCM or APNs stays a manual or farm-level check.

**Follow-ups:**
- *Why not test push only on an emulator?* The emulator needs Google Play services images and still does not prove the real path or vendor battery rules. Real devices find the delivery and delay bugs.
- *What about silent push or delayed push?* Check the payload and timing against the product rule, and the behaviour when the app is killed by the system.

**Trap:** Checking only that "a notification appears". The product bugs are the wrong screen after the tap, the wrong user's data and the killed-app case.

**Source:** https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/execute-methods.md

### How do you test deep links, universal links and App Links?

Topic: mobile-general | Standard | id: q0848

**Say:** A deep link opens the app on a specific screen from a URL. On Android there are custom scheme links and verified App Links for your own domain. On iOS there are custom schemes and universal links. I test them with the app installed and not installed, running and killed, and logged in and logged out. I check the target screen, the data, and what happens with a bad or expired link. In automation, Appium has a `mobile: deepLink` method on both drivers, which is more reliable than typing the URL into a browser.

**Full process:**
1. List the link formats from the developers, for example `myapp://order/123` and `https://example.com/order/123`.
2. App running, logged in: open each link. Expect the order screen for order 123.
3. App killed: open the link. Expect a cold start straight into the screen, or into login and then the screen after login.
4. App not installed: open the https link. Expect the store page or the website, as the product defines.
5. Invalid id, another user's id, expired token. Expect a safe error screen and no data leak.
6. Automation, Android: `await driver.executeScript('mobile: deepLink', [{ url: 'myapp://order/123', package: 'com.example.app' }])`. The `package` field is needed for older driver versions, newer ones default to the app under test.
7. Automation, iOS: `await driver.executeScript('mobile: deepLink', [{ url: 'myapp://order/123', bundleId: 'com.example.app' }])`. This method needs a recent XCUITest driver and iOS 16.4 or later.
8. Assert on the screen with an accessible name, not on the URL.

**Follow-ups:**
- *What is the difference between a deep link and an App Link?* Android deep links are routed by intent filters and can show a disambiguation dialog. App Links are verified links to your own domain, which open the app directly.
- *Which negative test do you add?* A link for another user's object, because it is an access control check.

**Trap:** Testing only the link that opens the home screen. The value is in the state combinations and the bad links.

**Source:** https://developer.android.com/training/app-links

### How do you test offline mode and bad network conditions?

Topic: mobile-general | Standard | id: q0849

**Say:** I test three situations: no network at all, a slow or flaky network, and a switch of network in the middle of a request, for example from Wi-Fi to mobile data. I check that the app shows a clear state, keeps what the user typed, does not send duplicates when the connection returns, and syncs correctly. I can switch the network off on a device or emulator and shape it with the emulator's network speed setting, or with a proxy such as Charles. For automation on Android, Appium can toggle Wi-Fi, mobile data and airplane mode.

**Full process:**
1. Choose the flow with writes (create a note, send a message, place an order).
2. Online, open the screen. Switch to airplane mode. Perform the action.
3. Expect: a visible offline state, the action queued or blocked as the product defines, and no data loss on screen.
4. Switch the network back. Expect sync once, no duplicate, correct order.
5. Slow network: on an Android emulator, use the network speed option (for example `edge`) or the Appium method `mobile: networkSpeed`. For real devices use a proxy that throttles, such as Charles Proxy.
6. Mid-request loss: start the action, cut the network at once, wait for the timeout. Expect an error and a safe retry, and check the backend for a duplicate record.
7. Automation, Android: `await driver.executeScript('mobile: setConnectivity', [{ wifi: false, data: false }])`. The driver notes that on real devices state switching works only from Android 11, and that the session can drop when the network changes, so reopen it with `noReset` when you need to restore.

**Follow-ups:**
- *Which bug do you expect most?* A double submit after a retry, and a "success" shown before the server confirmed.
- *How do you check the duplicate?* Query the backend or the API for the record count after the retry.

**Trap:** Testing "no internet" with the airplane switch and nothing else. The nasty cases are slow, flaky and mid-request.

**Source:** https://github.com/appium/appium-uiautomator2-driver/blob/master/README.md

### What do you test when a new app version replaces an old one (updates and reinstalls)?

Topic: mobile-general | Standard | id: q0850

**Say:** The update path is a classic source of bugs, because real users do not start from a clean install. I install the previous store version, create data and a logged-in state, then update to the new build, and check that the data, the login and the settings survive and that any database migration works. I also test skipping versions, a forced update screen when the version is too old, and a clean reinstall.

**Full process:**
1. Install the previous production build (from TestFlight or the Play track, or an archived apk or ipa).
2. Log in, create representative data, change settings, grant permissions.
3. Install the new build over it without uninstalling. On Android: `adb install -r app-new.apk`. On iOS: install the new build from TestFlight or Xcode over the old one.
4. Open the app. Expect: no logout unless intended, data present, settings kept, no crash on the first launch.
5. Skip a version: start from the build two versions back.
6. Minimum version: lower the supported version in the backend config, expect the forced update screen.
7. Uninstall and reinstall. Expect a clean state, and check whether data is restored from the account.
8. Automation: with Appium, use `mobile: installApp` and `mobile: terminateApp` style methods or the `noReset` capability, so a session keeps app data between runs.

**Follow-ups:**
- *What is hardest to catch?* A local database migration that fails only for a certain old schema. It needs the old data, not only the old version.
- *Where do you get old builds?* From the build system artifacts, TestFlight build history, or the Play Console.

**Trap:** Testing the new build only on a fresh install.

**Source:** https://appium.io/docs/en/latest/guides/caps/

### How do TestFlight and Play Console testing tracks work?

Topic: mobile-general | Standard | id: q0851

**Say:** TestFlight is Apple's beta distribution. You upload a build to App Store Connect, add internal testers (up to 100 people from your team) and external testers (up to 10,000). The first build for external testers goes through a light review, and a build can be tested for 90 days. Google Play has three testing tracks before production: internal testing for up to 100 testers, then closed, then open. Internal testing is the fast one for QA checks. I use these to put the real signed build in the hands of testers, because it is the same build path as production.

**Full process:** Getting a build to testers.
1. iOS: the pipeline archives and uploads the build to App Store Connect. Wait for processing. Provide test information and what to test.
2. Create a tester group, add the build, add testers by email or public link. Internal testers are App Store Connect users. External testers need the first build approved by App Review.
3. Testers install TestFlight, accept the invite, install the build, and send feedback or crash reports through TestFlight.
4. Android: in Play Console, create a release on the internal testing track, add a tester list (Google accounts), and share the opt-in link. After the first publish, the test link can take several hours to become available.
5. Closed track: specific groups. Open track: anyone with the link or the store listing for testing. A personal Play developer account created after 13 November 2023 must also run a closed test with at least 12 testers opted in for 14 days before it can apply for production access.
6. Promote the same build up the tracks, so what you tested is what ships.
7. Record the build number and version in each bug report.

**Follow-ups:**
- *Why test the store build and not only the apk or ipa from CI?* Signing, store processing and distribution can change behaviour, for example push entitlements and deep link verification.
- *What do reviews of test tracks affect?* Feedback from test users does not affect the public rating.

**Trap:** Saying TestFlight has "unlimited testers". The documented limits are 100 internal and 10,000 external.

**Source:** https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

### How do you collect device logs and crash information when a mobile test fails?

Topic: mobile-general | Standard | id: q0852

**Say:** A mobile bug without logs is hard to fix. On Android I use `adb logcat`, which is the system log, and I filter by the app package or by crash priority. On iOS I use the Console app or Xcode device logs, and the crash reports in the Devices window, or TestFlight crash feedback. In automation, I save a screenshot, the page source and the device log when a test fails, and sometimes a screen recording, and attach them to the report. In the bug itself I write the device model, OS version, build number and steps.

**Full process:**
1. Android, capture while reproducing: `adb logcat -c` to clear, reproduce, then `adb logcat -d > run.log` to dump. Logcat has separate buffers, and the `crash` buffer holds crash logs: `adb logcat -b crash -d`.
2. Filter by priority and tag when the log is noisy, for example `adb logcat *:E` for errors.
3. iOS: connect the device, open Console on a Mac and filter by the app process name. For a simulator, look at the simulator device logs.
4. Crashes: open Xcode, Window, Devices and Simulators, view the device's crash logs, or read TestFlight crash feedback.
5. In a TypeScript Appium run, on failure: `await driver.saveScreenshot('fail.png')`, `fs.writeFileSync('source.xml', await driver.getPageSource())`, and attach them to the test report.
6. Bug template: device, OS version, app version and build, network, account, steps, expected, actual, log excerpt, screenshot or video.

**Follow-ups:**
- *What do you look for in logcat?* A `FATAL EXCEPTION` stack trace, an ANR note, or a failed network call around the time of the failure.
- *Can Appium fetch logs?* Yes, drivers expose log types, and which ones depend on the driver and server security options. Check the driver docs for the version.

**Trap:** Attaching only a screenshot of the error toast.

**Source:** https://developer.android.com/tools/logcat

### How do you test mobile accessibility with VoiceOver and TalkBack?

Topic: mobile-general | Standard | id: q0853

**Say:** I turn on the real screen reader and use the app without looking at the screen. VoiceOver on iOS and TalkBack on Android. I check that every control has a name and a role, that the reading order makes sense, that focus moves correctly when a dialog opens and closes, that touch targets are large enough, and that text still fits with a large font size and in dark mode. If you have done screen reader testing with NVDA, VoiceOver and TalkBack, together with keyboard-only navigation, mention that.

**Full process:**
1. Turn on VoiceOver (Settings, Accessibility) or TalkBack (Settings, Accessibility). Learn the gestures: swipe right to the next item, double tap to activate.
2. Walk the main flows. Listen for every control. Each must announce a name and a role, for example "Send, button".
3. Check the order of focus against the visual order.
4. Open a dialog or bottom sheet. Expect focus to move into it and return to the trigger when it closes.
5. Check images and icons: informative ones have a label, decorative ones are hidden from the reader.
6. Set the font size to the largest and the display to dark mode. Expect no cut-off or overlap.
7. Run an automated scanner as a first pass: Accessibility Scanner on Android, Accessibility Inspector audit in Xcode for iOS. Then do the manual pass, because scanners miss reading order and meaning.
8. File the issues with the criterion, for example WCAG 4.1.2 Name, Role, Value.

**Follow-ups:**
- *Is the same ID used by tests and by screen readers?* Yes, on both platforms the accessibility label or identifier is what Appium reads as "accessibility id", so good labels help users and tests.
- *Which target size?* Flutter's guideline API checks for 48 by 48 on Android, as an example of a platform recommendation.

**Trap:** Running only an automated scanner and calling the app accessible.

**Source:** https://docs.flutter.dev/ui/accessibility/accessibility-testing

### What are the most common challenges in mobile test automation?

Topic: mobile-general | Standard | id: q0854

**Say:** Slowness, flakiness and environment. Mobile tests are slower than web tests because of the app install and device boot. They are flaky when they use timing instead of conditions, because animations, keyboards and system dialogs interrupt them. Locators are a problem when the app has no accessibility identifiers. The environment is a problem too: device state, OS updates, shared accounts, and Android and iOS needing different setup. My approach is to push most checks down to API and unit level, keep a small stable E2E set, use accessibility identifiers, wait on conditions, and reset state per test.

**Full process:** How I keep a mobile E2E suite stable.
1. Ask developers to add accessibility identifiers or labels to every control a test needs. This is the biggest single stabiliser.
2. Replace sleeps with explicit waits on a condition, for example `await el.waitForDisplayed({ timeout: 10000 })`.
3. Reset state per test with the app launched fresh, or with a known account created through the API, not through the UI.
4. Disable animations on test devices and emulators where the platform allows.
5. Handle system dialogs by granting permissions through capabilities or driver methods.
6. Keep the E2E set small. Test logic through API and unit tests.
7. Track flaky tests by repeat runs and fix the root cause, not with blind retries.

**Follow-ups:**
- *How do you know a failure is flaky and not a bug?* Repeat the run many times on the same build. A stable failure is a bug, an intermittent one is a race or an environment issue until proven otherwise.
- *Real device or emulator for stability?* Emulators are more predictable. Real devices find real problems but need a managed lab.

**Trap:** Blaming the tool ("Appium is flaky"). Most flakiness is a missing wait condition or shared state.

**Source:** https://appium.io/docs/en/latest/intro/appium/

### How do you write one test that runs on both iOS and Android?

Topic: mobile-general | Standard | id: q0855

**Say:** The cleanest way is to make both apps expose the same accessibility identifiers, then locate by accessibility id and keep the platform differences in a small layer. The test describes the user flow, and a page object hides the platform. If identifiers differ, the page object holds one locator per platform, chosen by `platformName`. I would not use XPath as the shared locator, because it differs between platforms and is slow.

**Full process:** A shared page object in TypeScript with WebdriverIO.
1. Agree identifiers with the developers (for example `login-email`, `login-submit`). On iOS these come from the accessibility identifier. On Android they come from the content description.
2. Write the page object with one place for platform differences:

```ts
import type { Browser } from 'webdriverio';

type Platform = 'android' | 'ios';

export class LoginPage {
  constructor(
    private readonly driver: Browser,
    private readonly platform: Platform,
  ) {}

  private get email() {
    return this.driver.$('~login-email');
  }

  private get submit() {
    return this.platform === 'android'
      ? this.driver.$('android=new UiSelector().text("Log in")')
      : this.driver.$('-ios predicate string:label == "Log in"');
  }

  async login(email: string): Promise<void> {
    await this.email.setValue(email);
    await this.submit.click();
  }
}
```
3. In the test, create the driver from a capability set chosen by an environment variable, such as `PLATFORM=android`, and pass the platform to the page object.
4. Assertions stay in the test, not in the page object.
5. Run the same spec twice in CI, once per platform.

**Follow-ups:**
- *What do you do for platform-only features?* Tag those tests per platform and skip them on the other.
- *Is cross-platform code always worth it?* Only where the flow is the same. Forcing one test over different flows hides platform bugs.

**Trap:** Sharing locators by XPath that contains class names. The class names differ per platform.

**Source:** https://webdriver.io/docs/selectors

### How would you design the mobile automation strategy for an app released weekly to both stores across about 20 device profiles?

Topic: mobile-general | Standard | id: q0856

**Say:** I would use a pyramid with a thin E2E top. Most checks at unit and API level, which run on every commit. A small set of critical-path E2E tests on virtual devices on every merge, for example login, core purchase or main flow. A wider regression run on real devices before the weekly release. Twenty device profiles are not twenty full runs: I would split them in tiers, with a few real devices for the full set and the rest on a farm for smoke only. The store build goes to TestFlight and the internal track first, and I add monitoring and crash reporting after release, because weekly releases need fast feedback.

**Full process:** A pipeline plan.
1. On every pull request: unit tests and API tests, plus lint and type checks. Minutes, no devices.
2. On merge to main: build debug apps, run critical-path E2E on one Android emulator and one iOS simulator, parallel. Target under 15 minutes.
3. Nightly: wider E2E on emulators and simulators across OS versions.
4. Release candidate (once a week): signed build to TestFlight and the Play internal track. Run the smoke set on the tier 2 real devices. Run the full manual exploratory charter on the new features.
5. Device farm: run the smoke set on the long-tail profiles in parallel.
6. Go or no-go: crash-free sessions in the beta, no open blockers, upgrade path checked.
7. After release: watch crash and error dashboards, and keep a rollback or a hotfix path ready.

**Follow-ups:**
- *What do you cut when time is short?* Cut breadth (device count) before depth on the critical path.
- *How do you handle a flaky E2E test blocking a release?* Quarantine it with a ticket and an owner, and do not retry blindly.

**Trap:** Proposing to automate everything on every device. It does not fit a weekly cadence.

**Source:** https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

### How do you test mobile web, and what does device emulation in a browser miss?

Topic: mobile-general | Standard | id: q0857

**Say:** For mobile web I start with a desktop browser that emulates a phone: viewport, user agent, touch, locale and geolocation. In Playwright that is a device descriptor in the project config. It is fast and good for layout and responsive checks in CI. But it does not run the real mobile engine or the real hardware, so I confirm on a real iPhone with Safari and a real Android device with Chrome for things like the virtual keyboard, scrolling and viewport quirks, touch gestures and performance.

**Full process:**
1. Configure mobile projects in `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
});
```
2. Run `npx playwright test --project="Mobile Safari"`. Each test runs with the device's viewport, user agent and touch support.
3. Check layout at the breakpoints, the hamburger menu, tap targets, and that nothing is hidden.
4. Emulate locale, timezone and permissions in the context when the feature depends on them.
5. Manual pass on real devices for keyboard overlap, address bar resizing, pinch zoom and slow network.
6. Note the limitation: the "Mobile Safari" project in Playwright uses the WebKit engine, which is close to Safari but is not Safari on an iPhone.

**Follow-ups:**
- *Is this a mobile test?* It is a responsive web test. It does not cover the native app.
- *What else do you emulate?* Geolocation, locale, timezone, permissions and color scheme, according to the Playwright docs.

**Trap:** Claiming emulation covers real-device behaviour.

**Source:** https://playwright.dev/docs/emulation

### What would you check for mobile app performance?

Topic: mobile-general | Standard | id: q0858

**Say:** The user feels startup time, screen load time, smoothness of scrolling, battery use and memory. I measure cold start (app killed) and warm start, check frame drops on long lists, and watch memory growth over a long session, because a leak shows up as a crash later. I use the platform profilers, Android Studio Profiler and Xcode Instruments, on a real mid-range device, because a flagship hides problems. I test under a slow network too, since most perceived slowness is waiting on requests.

**Full process:**
1. Pick a baseline device (a mid-range real phone) and a baseline build.
2. Cold start: kill the app, launch, time until the first usable screen. Repeat 5 to 10 times and take the median.
3. Key screens: time from tap to content, with a normal network and a slow network.
4. Scrolling: open the longest list, scroll fast, watch for dropped frames in the profiler.
5. Memory: use the app for 15 to 30 minutes across several screens, watch memory in the profiler. Rising memory that does not go down points to a leak.
6. Battery and heat: run a long session, compare battery drain to the previous build.
7. Compare each build to the previous one and report the change, not only the absolute number.

**Follow-ups:**
- *Can Appium measure performance?* It can read some data from the device (the drivers expose performance data methods) but I would use the platform profilers for real analysis.
- *Why a mid-range device?* Because the developer's flagship phone hides slow code.

**Trap:** Testing performance only on a fast emulator on a fast laptop.

**Source:** https://developer.android.com/studio/run/emulator

## Appium and the other mobile automation tools

### What is Appium and how does its architecture work?

Topic: mobile-appium | Niche | id: q0859

**Say:** Appium is an open-source automation server for UI testing. It uses the W3C WebDriver protocol as its API, so the test code, written in TypeScript, sends HTTP commands to the Appium server. The server passes the commands to a platform driver: UiAutomator2 for Android and XCUITest for iOS. The driver then talks to the device through the platform's own automation framework. So the chain is: test script, WebDriver HTTP, Appium server, driver, device or emulator. If you have about a year of Appium experience with TypeScript, state that.

**Full process:** What happens in a run.
1. Install Appium and the drivers: `npm i -g appium`, then `appium driver install uiautomator2` and `appium driver install xcuitest`.
2. Start the server: `appium`. It listens on port 4723 by default.
3. The test creates a session by sending capabilities (platform, driver name, app path). The server picks the driver that matches `appium:automationName`.
4. The driver installs and launches the app. On Android, UiAutomator2 runs a server app on the device. On iOS, the XCUITest driver uses WebDriverAgent running on the device or simulator.
5. Each command (find element, tap, type) goes over HTTP to the server, then to the driver, then to the device. The result goes back the same way.
6. At the end the test deletes the session and the driver cleans up.
7. Where output lands: test results in the test runner, Appium logs in the server terminal, device logs from adb or the Console.

**Follow-ups:**
- *Why WebDriver?* It is a standard API that browsers also implement, so the same concepts (sessions, elements, actions) apply.
- *Which language can you use?* Any with an Appium or WebDriver client. I use TypeScript with WebdriverIO.

**Trap:** Saying "Appium talks directly to the app". It talks to a driver, which uses the platform's automation framework.

**Source:** https://appium.io/docs/en/latest/intro/appium/

### What changed between Appium 1, 2 and 3?

Topic: mobile-appium | Niche | id: q0860

**Say:** Appium 2 was a big architecture change. The core server became small, and the drivers and plugins moved into separate packages that you install and update on their own. In Appium 1 all drivers came bundled. Appium 2 also removed old deprecated features and requires the `appium:` prefix for Appium-specific capabilities. Appium 3 continued with cleanup. One practical change is that insecure feature flags now need a driver prefix, like `uiautomator2:adb_shell`. If you have mainly worked in the Appium 2 style of installing drivers separately, say so.

**Full process:** Checking what you have.
1. `appium --version` shows the server version.
2. `appium driver list --installed` shows installed drivers. Install with `appium driver install uiautomator2`.
3. `appium driver list --updates` shows driver updates, and `appium driver update xcuitest` updates one driver. Drivers update independently from the server.
4. Capabilities: Appium-specific ones need the `appium:` prefix, for example `appium:automationName`.
5. Insecure features: start the server with `appium --allow-insecure=uiautomator2:adb_shell`. In Appium 3 the prefix is mandatory, and a wildcard form `*:adb_shell` keeps the old behaviour for all drivers.
6. Plugins: `appium plugin install <name>`, then enable at start with `appium --use-plugins=<name>`.

**Follow-ups:**
- *Why a modular design?* A driver can release a fix without waiting for a server release, and the community can write drivers for more platforms.
- *Is the migration safe by in-place update?* The docs recommend uninstalling Appium 1 first, then installing Appium 2.

**Trap:** Claiming specifics of every version change from memory. State the architecture change and the prefix rules, which are documented.

**Source:** https://appium.io/docs/en/latest/guides/migrating-1-to-2/

### What are Appium capabilities? Walk me through configuring an Android session and an iOS session.

Topic: mobile-appium | Niche | id: q0861

**Say:** Capabilities are the key-value parameters that start a session: which platform, which driver, which app, which device. They cannot change during the session. The standard ones are `platformName` and a few others, and Appium-specific ones need the `appium:` prefix. For Android I set the platform, the UiAutomator2 driver name, and the app path, and optionally the device id and auto-granting permissions. For iOS I set XCUITest, the platform version, the device, and the app or bundle id. For a real iOS device I also need signing settings for WebDriverAgent.

**Full process:** Two sessions in TypeScript with WebdriverIO.

```ts
import { remote } from 'webdriverio';

const android = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:app': '/abs/path/app-debug.apk',
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 120,
  },
});

const ios = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:platformVersion': '17.5',
    'appium:deviceName': 'iPhone 15',
    'appium:app': '/abs/path/App.app',
  },
});
```
1. Start the Appium server first, with the driver installed.
2. `remote()` sends the capabilities to the server, which starts the session and launches the app. Wait for it before any command.
3. For a real iOS device, add `appium:udid` and the signing capabilities `appium:xcodeOrgId`, `appium:xcodeSigningId` and `appium:updatedWDABundleId`.
4. If the app is already installed, use `appium:bundleId` (iOS) instead of `appium:app`.
5. Always end with `await driver.deleteSession()` in a `finally` block, so the device is released.
6. Keep capabilities in one config file per platform and select it with an environment variable.

**Follow-ups:**
- *Can you change capabilities during a session?* No. If a driver supports behaviour changes, it uses the Settings API.
- *What does `noReset` do?* It keeps the app data between sessions, so the app is not reinstalled and cleared at start.

**Trap:** Forgetting the `appium:` prefix. The server rejects unknown non-prefixed capabilities.

**Source:** https://appium.io/docs/en/latest/guides/caps/

### What locator strategies does Appium offer, and which do you prefer?

Topic: mobile-appium | Niche | id: q0862

**Say:** My first choice is accessibility id, because it is stable, works on both platforms and is also what screen readers use. On Android it maps to the content description, on iOS to the accessibility identifier. Next are platform-native strategies: the id or UiAutomator selector on Android, and iOS predicate strings or class chain on iOS. They are fast and readable. XPath is the last resort, because it is slow and fragile, and it depends on the element tree. I use Appium Inspector to look at the tree and try locators. If an element has no good locator, I ask the developers to add an accessibility label, the same as I did for web.

**Full process:** The strategies with WebdriverIO syntax.
1. Accessibility id: `await driver.$('~login-submit')`.
2. Android UiAutomator: `await driver.$('android=new UiSelector().text("Log in")')`, or by resource id with `resourceId("com.example:id/login_button")`.
3. iOS predicate string: `await driver.$('-ios predicate string:label == "Log in"')`.
4. iOS class chain: `` await driver.$('-ios class chain:**/XCUIElementTypeButton[`label == "Log in"`]') ``.
5. XPath, for example `//android.widget.Button[@text="Log in"]` or `//XCUIElementTypeButton[@label="Log in"]`: only when nothing else works.
6. Use Appium Inspector to start a session, click an element, and see its attributes and suggested locators.
7. Wrap locators in page objects, so a change happens in one place.

**Follow-ups:**
- *Why is XPath slow on mobile?* The driver has to build and search the whole element tree for each query, and the tree is large.
- *How does this connect to your web work?* On web I locate by role and name, the same idea: use what the user and assistive technology see.

**Trap:** Using index-based or text-based XPath because it works today. Text changes with translation, and the index changes with layout.

**Source:** https://webdriver.io/docs/selectors

### What is the difference between accessibility id and resource-id?

Topic: mobile-appium | Niche | id: q0863

**Say:** On Android, the resource id is the identifier in the app's resources, in the format `package:id/name`. It is for developers and exists on most views, but only on Android. Accessibility id is the content description on Android and the accessibility identifier on iOS, so it is the cross-platform one, and screen readers can read it. But note one risk: on Android the content description is also read aloud, so a test-only value there can hurt real users. The best approach is a label that is meaningful for users and stable for tests.

**Full process:**
1. Open Appium Inspector, select the element, read both attributes.
2. Resource id lookup in WebdriverIO: `await driver.$('android=new UiSelector().resourceId("com.example:id/login_button")')`.
3. Accessibility id lookup: `await driver.$('~Log in')`.
4. Decide with the developers: for cross-platform tests use accessibility id, for Android-only low-level checks use resource id.
5. In React Native, the `testID` prop becomes a resource id on Android and an accessibility identifier on iOS, and `accessibilityLabel` is what screen readers read.

**Follow-ups:**
- *Can a test-only accessibility id hurt?* Yes, if it is spoken by TalkBack and reads like "btn_login_v2". Use real names.

**Trap:** Treating accessibility id as "the test id". On Android it is spoken to users.

**Source:** https://reactnative.dev/docs/accessibility

### How do you perform a swipe or scroll in Appium?

Topic: mobile-appium | Niche | id: q0864

**Say:** In Appium 2 and later I use the W3C Actions API, which sends a touch pointer: press down, move, release. It works on both platforms. The drivers also offer higher-level gesture methods for swipe and scroll, but the W3C actions are the portable way. I base the swipe on the screen size, not on fixed pixel values, so it works on different devices. After the swipe I wait for the target element, not for a fixed time.

**Full process:** A swipe up in TypeScript with WebdriverIO.

```ts
import type { Browser } from 'webdriverio';

export async function swipeUp(driver: Browser): Promise<void> {
  const { width, height } = await driver.getWindowSize();
  const x = Math.round(width / 2);
  const startY = Math.round(height * 0.8);
  const endY = Math.round(height * 0.2);

  await driver
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x, y: startY, duration: 0 })
    .down()
    .move({ x, y: endY, duration: 600 })
    .up()
    .perform();
}
```
1. Read the window size, compute start and end points as fractions.
2. Build the action: move to start, press, move to end over 600 ms, release.
3. Call `perform()`, which sends the action sequence to the driver.
4. After it, `await target.waitForDisplayed()`. If the element is not found, repeat the swipe a limited number of times and then fail with a clear message.

**Follow-ups:**
- *Why not fixed coordinates?* The same pixels point to different content on different screens.
- *How do you scroll to an element on Android?* UiAutomator offers `UiScrollable(...).scrollIntoView(...)` in a selector, which I would try first for long lists.

**Trap:** Using the old TouchAction API, which was removed in favour of W3C actions.

**Source:** https://webdriver.io/docs/api/browser/action

### How do you deal with flaky Appium tests and waits?

Topic: mobile-appium | Niche | id: q0865

**Say:** I wait on conditions, never on fixed sleeps. I use explicit waits for an element to be displayed or for a state to be true, with a sensible timeout. I make sure every element has a stable locator, I reset the app state per test, and I avoid sharing accounts between parallel runs. When a test fails intermittently, I repeat it many times to measure the failure rate, find the root cause (a race, an animation, a system dialog, shared data) and fix that, instead of adding retries. I keep retries only as a visible, limited policy, and I report which tests needed them.

**Full process:**
1. Replace sleeps with conditions: `await el.waitForDisplayed({ timeout: 10000 })` or `await driver.waitUntil(async () => (await el.getText()) === 'Done', { timeout: 10000, timeoutMsg: 'status did not become Done' })`.
2. Give each wait a message so the failure explains what was missing.
3. Start each test from a known state: fresh install or `noReset` with a known account created via API.
4. Disable animations on emulators where possible. Dismiss or pre-grant system dialogs.
5. Capture a screenshot, page source and device log on failure.
6. Measure: run the suspect test 50 to 200 times and count failures. Fix, and run again to show the rate is zero.
7. Never raise a global timeout to hide a slow screen. Ask why it is slow.

**Follow-ups:**
- *What about implicit waits?* Mixing implicit and explicit waits gives unpredictable timeouts. I prefer explicit waits only.
- *Do retries help?* They hide the cost. Use them as a tracked, limited measure, not as the fix.

**Trap:** `await driver.pause(5000)` in the test.

**Source:** https://appium.io/docs/en/latest/intro/appium/

### How do you handle system alerts and permission dialogs in Appium?

Topic: mobile-appium | Niche | id: q0866

**Say:** The first option is to avoid the dialog when it is not the thing under test: on Android I grant permissions at session start with a capability, and on iOS I can accept alerts automatically with a capability. When the dialog is what I test, I handle it like any element. On iOS, alert commands let me accept or dismiss it. On Android the permission dialog belongs to a system app, so I find its buttons by text or id, and the ids vary between Android versions, so I check them in Appium Inspector.

**Full process:**
1. Not under test, Android: capability `'appium:autoGrantPermissions': true`.
2. Not under test, iOS: capability `'appium:autoAcceptAlerts': true`. It accepts all iOS alerts, including privacy prompts, and defaults to `false`.
3. Under test, iOS: `await driver.acceptAlert()` or `await driver.dismissAlert()`.
4. Under test, Android: `await driver.$('android=new UiSelector().text("Allow")').click()`. The text depends on the OS language and version, so verify per OS in the Inspector.
5. Verify the outcome in the app (the feature works or shows the denied state), not only that the click worked.

**Follow-ups:**
- *What if the text is localised?* Set the device language for the run, or prefer ids from Inspector on that OS version.

**Trap:** Turning on auto-accept for the whole suite and then having no test for denial.

**Source:** https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/capabilities.md

### How do you run Appium tests in parallel?

Topic: mobile-appium | Niche | id: q0867

**Say:** Each parallel test needs its own device and its own session, and the sessions must not collide on ports or on data. A single Appium server can handle several sessions, but each driver needs unique ports: for Android UiAutomator2 a system port, and for iOS a WebDriverAgent port, per session. I assign one device per worker, give each worker its own test account, and run the spec files in parallel with the test runner. For many devices I use a device farm or a grid-style setup.

**Full process:**
1. List the devices: `adb devices` for Android, and Xcode or `xcrun simctl list` for iOS simulators.
2. Give each worker one device id through capabilities: `appium:udid`.
3. Give each worker unique driver ports, for example `appium:systemPort` for UiAutomator2 and `appium:wdaLocalPort` for XCUITest.
4. Use a different test account per worker, so state does not collide.
5. Configure the runner to start N workers (for example in WebdriverIO a `maxInstances` setting) and map worker index to device.
6. Collect per-worker logs and screenshots in separate folders.
7. Check that the total run is faster and not flakier. Parallel runs hide shared-state bugs until they fail.

**Follow-ups:**
- *Why unique ports?* The driver helper processes would otherwise try to bind the same port.
- *Can one device run two sessions?* No.

**Trap:** Running several sessions against one emulator and one account.

**Source:** https://appium.io/docs/en/latest/guides/caps/

### How do you integrate Appium with a device farm such as BrowserStack or Sauce Labs?

Topic: mobile-appium | Niche | id: q0868

**Say:** If you have not run Appium on a device farm in production, say so, then explain how it works. You upload the app build to the farm, then you point the test at the farm's Appium endpoint with your credentials, and you put the device name, OS version and the uploaded app reference in the capabilities, with vendor options in a vendor namespace. The test code stays the same. The farm gives video, logs and a report per session. The trade-offs are cost and speed, because sessions queue and run over the network, but you get many real devices without owning them.

**Full process:** How I would approach it.
1. Upload the app (apk or ipa) through the farm's upload API or CLI, and keep the returned app id or URL.
2. Change the connection options in the config: farm hostname, port and credentials taken from environment variables, never committed.
3. Add the farm's vendor options object to capabilities (it holds the device, OS version, build name and session name), as the farm documents.
4. Run the same test code. Keep the local config for emulators and the farm config for real devices, selected by an environment variable.
5. Name the build and session so failures are traceable, and link the farm video from the CI report.
6. Run a smoke set in parallel on the tier 2 and tier 3 devices.

**Follow-ups:**
- *What breaks when moving to a farm?* Test data and network assumptions. Local resources are not reachable, so the app must hit a public or tunnelled staging.
- *How do you pick devices?* From the device matrix.

**Trap:** Claiming farm experience. Say it is a concept for me, and explain the steps.

**Source:** https://appium.io/docs/en/latest/guides/caps/

### What causes "Session Not Created" or "socket hang up" in Appium, and how do you troubleshoot it?

Topic: mobile-appium | Niche | id: q0869

**Say:** "Session not created" almost always means the capabilities do not match what the driver can start: a wrong or missing `automationName`, a missing `appium:` prefix, a wrong app path, no device attached, or a driver that is not installed. I read the server log first, because it says exactly which capability or step failed. Then I check the device is visible, the driver is installed, the app file exists and is signed correctly, and the ports are free. "Socket hang up" often means the driver helper on the device died or was blocked, so I restart the server and the device session.

**Full process:**
1. Read the Appium server terminal output at the failure time. The first error line is the cause, the rest is the noise.
2. Check the driver: `appium driver list --installed`. Install the missing one.
3. Check the device: `adb devices` shows the device as `device` (not `unauthorized` or `offline`). For iOS, check the simulator is booted or the device is trusted.
4. Check the capabilities: prefixes, `appium:automationName` value, and the app path as an absolute path to an existing file.
5. iOS real device: check WebDriverAgent signing capabilities.
6. Check for a stale session or port clash: restart the server, stop leftover processes, and change the system port.
7. If it still fails, run the same capabilities in Appium Inspector. It isolates the problem from the test code.

**Follow-ups:**
- *What first, test code or environment?* Environment and capabilities, because a session failure happens before any test code runs.

**Trap:** Rerunning the test several times and hoping.

**Source:** https://appium.io/docs/en/latest/guides/caps/

### Appium versus Espresso and XCUITest: what are the trade-offs?

Topic: mobile-appium | Niche | id: q0870

**Say:** Espresso on Android and XCUITest on iOS are the native frameworks. They run inside or next to the app, they are faster and more stable, and Espresso synchronises with the UI thread by itself, so it needs fewer waits. But they are one platform each, written in Kotlin, Java or Swift, and best for developers who know the code. Appium is black-box, cross-platform and language-flexible, so one team and one language can cover both platforms, at the cost of speed and some flakiness. I would pick native frameworks for developer-owned UI tests on one platform, and Appium for a QA-owned cross-platform suite.

**Full process:** How I compare when advising a team.
1. Who writes and maintains the tests: developers (native frameworks) or QA (Appium)?
2. Language and tooling: Appium lets me stay in TypeScript, with the same tools as my web tests.
3. Speed and stability: Espresso waits until the UI is idle, using synchronization conditions such as the message queue and idling resources. Appium needs explicit waits.
4. Reach: Appium can test any installed app and system dialogs. Espresso tests the app under test.
5. Maintenance: two native suites mean two codebases, one Appium suite means one.
6. Decision: start with a thin Appium suite for the critical path, and let developers own native UI tests close to the code.

**Follow-ups:**
- *Can they be combined?* Yes. Native tests for component-level UI behaviour, Appium for end-to-end flows.

**Trap:** Saying one is "better". The right answer depends on who owns the tests and the platforms.

**Source:** https://developer.android.com/training/testing/espresso

### What is Detox, and how is it different from Appium?

Topic: mobile-appium | Niche | id: q0871

**Say:** If you have not used Detox in production, say so, then explain how it works. Detox is a gray box end-to-end framework for mobile apps, built mainly for React Native. Gray box means it runs alongside the app and monitors its async work, such as network requests, animations and timers, and waits until the app is idle before the next action. That removes most explicit waits and makes tests less flaky. It runs on simulators and emulators, with Jest as the test runner, and tests are written in JavaScript or TypeScript. Appium is black box, supports many app types and languages, and needs explicit waits.

**Full process:** What a Detox test looks like.
1. Install Detox and Jest in the React Native project and configure a `.detoxrc` file with the app build commands and device types.
2. Build the app for testing, then run `npx detox test`.
3. A test launches and drives the app:

```ts
describe('login', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows the welcome screen after login', async () => {
    await element(by.id('login-email')).typeText('user@example.com');
    await element(by.id('login-submit')).tap();
    await expect(element(by.text('Welcome'))).toBeVisible();
  });
});
```
4. Detox synchronises with the app, so there is no sleep between the tap and the assertion.
5. `device.launchApp` can also grant iOS permissions, open a URL to test a deep link, and launch with a mocked user notification.
6. If something in the app never goes idle (an endless animation or poll), synchronisation blocks, and the docs describe how to disable synchronization for that case.

**Follow-ups:**
- *When would you pick Detox over Appium?* For a React Native app where the team wants fast, stable tests that live in the app repository.
- *What are the limits?* Mainly simulators and emulators, and it needs a debug-style build and setup in the app project.

**Trap:** Saying Detox is "Appium for React Native". It is a different model (gray box with synchronization).

**Source:** https://github.com/wix/detox/blob/master/docs/api/device.md

### What is Maestro, and when would you use it?

Topic: mobile-appium | Niche | id: q0872

**Say:** If you have not used Maestro in production, say so, then explain how it works. Maestro is a mobile UI testing tool where flows are YAML files: launch the app, tap on a text, type a value, assert something is visible. It runs on Android, iOS and web from the same flow. It has no code to write, so it is quick to start, and manual testers and developers can both read it. For complex logic, loops or API setup I would prefer code in TypeScript with Appium. For simple critical-path smoke flows, Maestro is attractive.

**Full process:** A first flow.
1. Start an emulator or simulator and install the app.
2. Create `login.yaml`:

```yaml
appId: com.example.app
---
- launchApp:
    clearState: true
- tapOn: "Email"
- inputText: "user@example.com"
- tapOn: "Log in"
- assertVisible: "Welcome"
```
3. Run it: `maestro test login.yaml`.
4. Maestro finds elements by visible text or accessibility label, and by id when you write `tapOn: { id: "..." }`.
5. It waits for the screen to settle before the next command, within a configurable best-effort timeout.
6. Output: pass or fail per command in the terminal. You can add `takeScreenshot` or recording commands.

**Follow-ups:**
- *Limits?* Less flexible than a programming language for data setup and complex assertions.
- *Selectors?* Prefer ids or text over screen coordinates, which break across devices.

**Trap:** Using Maestro as proof of Appium skills. Different tools, say which one you used.

**Source:** https://docs.maestro.dev/maestro-flows

### How do you make a React Native app testable, and what do you do when you test one?

Topic: mobile-appium | Niche | id: q0873

**Say:** I test React Native apps and write some E2E tests for them, but I do not write the apps. What makes them testable is the same as on web: stable identifiers and accessible names. In React Native the `testID` prop gives an id for tests, and `accessibilityLabel` and `accessible` give the names that screen readers and Appium read. The framework builds real native views, so Appium or Detox can drive them. I ask developers for consistent ids on interactive elements, and for names that make sense to users.

**Full process:**
1. Ask the developers to set `testID` on interactive elements and containers a test needs, with a naming convention (for example `screen-element`).
2. Set `accessible` and `accessibilityLabel` on controls so screen readers announce them, and use real words.
3. Check the mapping in Appium Inspector: `testID` should appear as the resource id on Android and as the accessibility identifier on iOS.
4. Locate in tests by accessibility id first.
5. For Detox, use `by.id('...')`, which uses the `testID`.
6. Make state controllable: a test login route or a seeded account, and a way to reset local storage.
7. Check lists: virtualised lists render only visible rows, so scroll to the item before asserting.

**Follow-ups:**
- *Why does one set of props help both testing and accessibility?* Both read the accessibility layer of the platform.

**Trap:** Putting test-only text into `accessibilityLabel`, which users hear.

**Source:** https://reactnative.dev/docs/accessibility

### How would you test a Flutter app?

Topic: mobile-appium | Niche | id: q0874

**Say:** If you have tested apps built with Flutter but have not written Flutter tests, say so, then describe the approach. Flutter has three test levels: unit tests, widget tests, and integration tests that run the whole app. Widget and integration tests are written in Dart by the developers. A black-box tool can also drive a Flutter app, because Flutter exposes a semantics tree to the platform accessibility layer, so Appium and Maestro can find widgets by their semantic labels. The key requirement is that developers give widgets semantic labels, the same as on the other platforms.

**Full process:**
1. Ask which test levels exist: unit, widget, integration. Widget tests are quick, integration tests are slow and most expensive to maintain.
2. For a black-box QA suite, ask developers to add semantic labels to interactive widgets, so Appium sees them as accessibility ids.
3. Use Appium or Maestro on the compiled app. Locate by accessibility id.
4. Use Flutter's accessibility guideline checks in widget tests (tap target size and label guidelines) to catch problems early.
5. Check the web build with browser tools as well, since Flutter on web exposes ARIA attributes through its semantics layer.
6. Report the flow results like for any native app.

**Follow-ups:**
- *Why can Appium find Flutter widgets?* Through the semantics tree, which becomes platform accessibility nodes.

**Trap:** Claiming Flutter automation experience. Say "tested, did not automate, here is the approach".

**Source:** https://docs.flutter.dev/testing/overview

### How do you structure Appium tests in TypeScript with page objects?

Topic: mobile-appium | Niche | id: q0875

**Say:** The same way as my Playwright tests, with a few differences. Page objects hold locators and user actions, tests hold the assertions. The driver is created in a fixture or a hook, so each test starts a clean session or a clean app state. Locators sit in one place, so when the app changes I change one file. I keep platform differences in the page object or in config, not in the test. TypeScript gives me types for the page objects and the capabilities, and I keep my own TypeScript level as solid mid.

**Full process:**
1. Folder layout: `config/` (capabilities per platform), `pages/` (page objects), `tests/` (specs), `utils/` (swipe, waits).
2. A config file per platform exports the capabilities. An environment variable picks one.
3. A shared setup creates the driver, and a teardown deletes the session and saves artifacts on failure.
4. Page objects take the `driver` in the constructor and expose actions (`login(email)`), not raw clicks.
5. Specs call the actions and then assert, for example `await expect(home.welcome).toBeDisplayed()` with the WebdriverIO expect matchers.
6. Failure hooks save a screenshot, page source and device log.
7. CI runs `npm test` with `PLATFORM=android` and `PLATFORM=ios` jobs.

**Follow-ups:**
- *Why assertions not in page objects?* Page objects describe how to act, tests describe what must be true. It keeps failures readable.

**Trap:** One huge page object per app with every locator in it.

**Source:** https://webdriver.io/docs/selectors

### Walk me through your Appium setup.

Topic: mobile-appium | Niche | id: q0876

**Say:** State how long you used Appium and in which language. A concrete answer: start the Appium server with the Android and iOS drivers installed, create sessions with capabilities for the app build, and locate elements mainly by accessibility id, with native selectors where needed. Write tests as a page object layer plus specs, wait on conditions, and on failure keep a screenshot and the logs. Use Appium Inspector to find locators. Be honest about the scale: a regression suite for critical flows is not a large device-farm setup.

**Full process:** The setup, step by step.
1. Install: Node, Appium, the UiAutomator2 and XCUITest drivers, Android Studio for the emulators, Xcode for the simulators.
2. Start the server: `appium`.
3. Build the app, point `appium:app` at it, and create the session in a test hook.
4. Write the page objects and specs, run them, and read the results in the terminal and the report.
5. Debug with Appium Inspector and the device logs.
6. Keep the artifacts (screenshot, source) on failure.

**Follow-ups:**
- *What was the hardest part?* Pick one honest example: the system dialogs, waiting on animations, or the iOS signing for real devices. Only claim one you hit.
- *What would you improve?* Faster feedback with fewer E2E tests, accessibility identifiers added earlier, and a device farm for coverage.

**Trap:** Inflating the setup (grid, farm, hundreds of tests) beyond what you did.

**Source:** https://appium.io/docs/en/latest/intro/appium/

## Jest and React Native Testing Library

### What is React Native Testing Library, and where does it sit next to Jest, Detox and Appium?

Topic: mobile-appium | Niche | id: q0877

**Say:** Jest is the test runner: it finds the tests, runs them and gives me `expect` and mocks. React Native Testing Library runs inside Jest. It renders a component in Node, with no device or simulator, and lets me find things the way a user does, by role, label and text. Detox and Appium sit higher: they drive a built app on a simulator or device. So the library is fast and good for screen logic, and it can't prove the real navigation, native modules or the device. If you have used Jest a bit, say so. If you have not used this library in a project, say so plainly, then mention that you have practised it and that the idea matches Playwright's user-facing locators.

**Follow-ups:**
- *What does it not catch?* Native bugs, real keyboard and permission dialogs, and layout, because no pixels are drawn.
- *How much goes at which level?* Logic in unit tests, screens in component tests, and only the critical journeys in device E2E, because those are the slowest.

**Trap:** Saying these tests run on a device or simulator. They run in Node.

**Source:** https://oss.callstack.com/react-native-testing-library/docs/guides/how-to-query ; https://reactnative.dev/docs/testing-overview

### How do you choose a query? What is the difference between getBy, queryBy and findBy?

Topic: mobile-appium | Niche | id: q0878

**Say:** A query has two parts: the variant and the predicate. `getBy` expects exactly one element now and throws if it isn't there. `queryBy` returns null, so I use it only to prove something isn't on the screen. `findBy` returns a Promise and waits for something that appears after an async action. For the predicate, I start with role, then text and label, because that also pushes the app to be accessible. `testID` is the last resort, because a user never sees it.

**Full process:**

| Situation | Use |
|---|---|
| One element, already there | `getByRole('button', { name: 'Send' })` |
| A list | `getAllByText` |
| Appears after an async action | `await findByText('Payment sent')` |
| Must not be there | `expect(queryByText('Error')).not.toBeOnTheScreen()` |

**Follow-ups:**
- *Why not `queryAllBy`?* It asserts nothing about the count, so the docs say to avoid it in regular tests.
- *What matches `getByLabelText`?* `accessibilityLabel`, `aria-label`, and related props.

**Trap:** Using `getBy` to prove something is absent. It throws before the assertion runs.

**Source:** https://oss.callstack.com/react-native-testing-library/docs/guides/how-to-query

### userEvent or fireEvent?

Topic: mobile-appium | Niche | id: q0879

**Say:** I prefer `userEvent`, as the docs say to, because it reproduces the sequence of events a real interaction makes. `user.press` fires press in and press out, and it only reaches real host elements. `fireEvent` just calls a handler, and it can walk up the tree to find one. So `fireEvent` can pass on something a user couldn't actually do. I use it when `userEvent` doesn't support the event.

**Follow-ups:**
- *Why are `userEvent` tests slower?* A press takes at least 130 ms because of React Native's own logic. Fake timers speed that up.
- *Is it async?* Yes, so every `user.press` and `user.type` needs an `await`.

**Trap:** Forgetting the `await`, which is the same class of bug as in Playwright.

**Source:** https://oss.callstack.com/react-native-testing-library/docs/api/events/user-event

### Write a component test for a money transfer form.

Topic: mobile-appium | Niche | id: q0880

**Say:** I mock only what's outside the component, here the submit function. I type and press like a user. Then I assert what the user sees and what the component sent. I test the happy path, a table of invalid amounts where nothing must be sent, and a failed payment where the form must stay and show an error. A check that the function wasn't called matters as much as the message on the screen.

**Full process:** The component, then the tests. Ran on Jest 30.5, React Native 0.88 and React Native Testing Library 14.1, where `render` is awaited.

```js
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async () => {
    setError('');
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) === 0) {
      setError('Enter a valid amount');
      return;
    }
    try {
      await onSubmit(amount);
      setSent(true);
    } catch {
      setError('Payment failed, try again');
    }
  };
  if (sent) return <Text>Payment sent</Text>;
  return (
    <View>
      <TextInput accessibilityLabel="Amount" value={amount} onChangeText={setAmount} />
      <Pressable accessibilityRole="button" onPress={submit}><Text>Send</Text></Pressable>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
```

```js
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { TransferForm } from './TransferForm';

test('sends the typed amount and shows the confirmation', async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  await render(<TransferForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Amount'), '12.50');
  await user.press(screen.getByRole('button', { name: 'Send' }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith('12.50');
  expect(await screen.findByText('Payment sent')).toBeOnTheScreen();
});

test.each(['', '0', '1.999', 'abc'])('does not send an invalid amount: "%s"', async (value) => {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  await render(<TransferForm onSubmit={onSubmit} />);

  if (value) await user.type(screen.getByLabelText('Amount'), value);
  await user.press(screen.getByRole('button', { name: 'Send' }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid amount');
});

test('keeps the form and shows an error when the payment fails', async () => {
  const onSubmit = jest.fn().mockRejectedValue(new Error('500'));
  const user = userEvent.setup();
  await render(<TransferForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Amount'), '5');
  await user.press(screen.getByRole('button', { name: 'Send' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Payment failed, try again');
  expect(screen.queryByText('Payment sent')).not.toBeOnTheScreen();
});
```

**Follow-ups:**
- *Why `test.each`?* Each bad value gets its own named test, so a failure says which value broke.
- *How do you know the test can fail?* I remove the zero check and watch the `"0"` row fail. That one failed, and the others passed.

**Trap:** Asserting only on the error text and never checking that the payment wasn't sent.

**Source:** https://oss.callstack.com/react-native-testing-library/docs/api/events/user-event

### How do you mock a module and test debounced search with fake timers?

Topic: mobile-appium | Niche | id: q0881

**Say:** `jest.mock('./api')` replaces the whole module with automatic mocks, so no test reaches the network. I reset the mock in `beforeEach`, so tests don't leak into each other. For a debounce I use fake timers: I type, check nothing was sent, move the clock past the delay, and check exactly one call with the final text. That's instant and deterministic, with no real waiting.

**Full process:** The component waits 300 ms after typing, then calls `searchPayees`. Removing that delay fails the first test, because a call then goes out too early.

```js
import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { SearchBox } from './SearchBox';
import { searchPayees } from './api';

jest.mock('./api');

beforeEach(() => {
  jest.useFakeTimers();
  searchPayees.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

test('sends one search after the user stops typing', async () => {
  searchPayees.mockResolvedValue([{ id: '1', name: 'Acme Ltd' }]);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<SearchBox />);

  await user.type(screen.getByLabelText('Search payees'), 'acme');
  expect(searchPayees).not.toHaveBeenCalled();

  await act(async () => { await jest.advanceTimersByTimeAsync(300); });

  expect(searchPayees).toHaveBeenCalledTimes(1);
  expect(searchPayees).toHaveBeenCalledWith('acme');
  expect(await screen.findByText('Acme Ltd')).toBeOnTheScreen();
});
```

**Follow-ups:**
- *`jest.fn`, `jest.spyOn` or `jest.mock`?* `jest.fn` makes a new mock function, `spyOn` wraps one method of a real object, and `jest.mock` replaces a whole module.
- *`mockClear`, `mockReset`, `mockRestore`?* Clear wipes the calls, reset also wipes the behaviour, and restore puts the original back on a spy.

**Trap:** Forgetting `jest.useRealTimers()`, so the fake clock leaks into the next test.

**Source:** https://jestjs.io/docs/timer-mocks ; https://jestjs.io/docs/mock-function-api

### What is the "not wrapped in act" warning?

Topic: mobile-appium | Niche | id: q0882

**Say:** React wants every state update in a test to happen inside `act`, so the screen is settled before I assert. The warning means an update came after the test stopped watching, usually a promise that resolved late. The library's `findBy`, `userEvent` and `render` already wrap this for me. So the warning usually means I forgot an `await`, or I don't wait for the async result. I fix the wait. I don't silence the warning.

**Follow-ups:**
- *When do you write `act` yourself?* When I move fake timers by hand, because that happens outside the library.

**Trap:** Hiding the warning with a console mock. It often points at a real race in the test.

**Source:** https://react.dev/reference/react/act

### When are snapshot tests useful, and when do they hurt?

Topic: mobile-appium | Niche | id: q0883

**Say:** A snapshot stores the rendered output in a file, and the next run compares against it. It's cheap protection against an unexpected change in a small, stable component. It hurts on big screens, because any change fails it, people run the update without reading, and the test no longer says what's correct. The Jest docs say the snapshot file must be committed and reviewed like code. For behaviour I write explicit assertions.

**Follow-ups:**
- *How do you update one?* `jest -u`, after reading the diff.
- *Is it visual testing?* No. It compares a serialized tree, not pixels.

**Trap:** Treating a green snapshot as proof that the behaviour is right.

**Source:** https://jestjs.io/docs/snapshot-testing

### How do you set up Jest for a React Native project?

Topic: mobile-appium | Niche | id: q0884

**Say:** A new project usually comes with Jest and a React Native preset. The preset handles the Babel transform and mocks the native parts, because Node has no native modules. Then I add React Native Testing Library. A common failure is a package shipped as untransformed code, which gives a syntax error from `node_modules`, and the fix is `transformIgnorePatterns`. A native module with no mock crashes too, so I mock it in the setup file.

**Full process:** The config that ran with React Native 0.88.

```js
// jest.config.js
module.exports = { preset: '@react-native/jest-preset' };
```

```js
// babel.config.js
module.exports = { presets: ['module:@react-native/babel-preset'] };
```

**Follow-ups:**
- *Which run in CI?* All of them on every merge request, because they need no device. They're the cheap layer.

**Trap:** Expecting a native module to work in Jest. The native side doesn't exist there.

**Source:** https://reactnative.dev/docs/testing-overview
