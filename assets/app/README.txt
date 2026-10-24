VOSB app launch pack
--------------------
splash-blank-white-1080x1920.png             PLAIN WHITE splash. Use this as the app's native splash so nothing shows before the animation.
splash-1080x1920.png / splash-1440x3040.png  Sharp static splash (logo on white), only if your app needs a logo splash.
splash-icon-android12-1152.png               Transparent logo for the Android 12+ SplashScreen API (fits the safe circle).
intro-1080x1920.mp4                          The animated opening (3.4 s) as a video, if your app builder accepts a video/GIF splash.
../logo.svg                                  Vector logo (sharp at any size).
../icon-512.png, ../icon-1024.png            App icons (transparent). ../icon-maskable-*.png: Android adaptive icon (white, safe zone).
The website itself plays the same animation inside the installed app (js/splash.js + js/splash-art.js).
Preview in any browser: https://www.voiceofstartup.bd/?splash=1
