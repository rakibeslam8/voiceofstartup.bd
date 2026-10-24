# Show only the website animation (no native logo screen)

The logo screen you see first is drawn by the Android app before the website loads, so it must be switched off
inside the app project / app-builder settings. The website cannot hide it.

## App builders (WebIntoApp, Appilix, Median, AppMySite, etc.)
Splash screen -> turn OFF, or upload `assets/app/splash-blank-white-1080x1920.png` (plain white).
Splash/background colour -> #FFFFFF. Keep the app icon = `assets/icon-512.png`.

## Android Studio / WebView / TWA (Android 12+)
`res/drawable/splash_transparent.xml`
```xml
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@android:color/transparent"/>
    <size android:width="1dp" android:height="1dp"/>
</shape>
```
`res/values/themes.xml` (launch theme)
```xml
<style name="Theme.App.Starting" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#FFFFFF</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splash_transparent</item>
    <item name="windowSplashScreenAnimationDuration">0</item>
    <item name="postSplashScreenTheme">@style/Theme.App</item>
</style>
```
Set `android:theme="@style/Theme.App.Starting"` on the launcher activity and call `installSplashScreen()` before `super.onCreate()`.

## Flutter (flutter_native_splash) / Capacitor
Flutter `pubspec.yaml`: `flutter_native_splash: { color: "#ffffff", android_12: { color: "#ffffff" } }` (no image), then `dart run flutter_native_splash:create`.
Capacitor `capacitor.config.json`: `"plugins": { "SplashScreen": { "launchShowDuration": 0, "backgroundColor": "#ffffff" } }`.
