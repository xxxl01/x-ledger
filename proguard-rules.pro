# ProGuard configuration for Expo React Native project

# ===========================================
# React Native Core
# ===========================================

# Keep React Native classes
-keep,allowobfuscation @interface com.facebook.react.bridge.ReactModuleInterface
-keep,allowobfuscation @interface com.facebook.react.bridge.ReactServiceInterface
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepMembers

# React Module Registry
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.bridge.ReactModuleInterface { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }

# Keep all ReactPackage classes
-keep class * implements com.facebook.react.ReactPackage { *; }

# TurboModule support
-keep class * extends com.facebook.react.turbomodule.TurboModule { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep NativeModule specs
-keep @com.facebook.react.module.annotations.ReactModule class * { *; }

# JSI
-keep class com.facebook.jni.** { *; }

# ===========================================
# Expo SDK
# ===========================================

# Keep all Expo modules
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }

# Expo Modules Core
-keep class expo.modules.core.** { *; }

# Expo Router
-keep class expo.modules.router.** { *; }

# Expo SQLite
-keep class expo.modules.sqlite.** { *; }
-keep class org.sqlite.** { *; }
-keep class org.sqlite.database.** { *; }

# Expo Image Picker
-keep class expo.modules.imagepicker.** { *; }

# Expo File System
-keep class expo.modules.filesystem.** { *; }

# Expo Splash Screen
-keep class expo.modules.splashscreen.** { *; }

# Expo Build Properties
-keep class expo.modules.buildproperties.** { *; }

# ===========================================
# Android Components
# ===========================================

# Keep Application class
-keep class * extends android.app.Application { *; }

# Keep Activities
-keep class * extends android.app.Activity { *; }
-keep class * extends androidx.appcompat.app.AppCompatActivity { *; }

# Keep Services
-keep class * extends android.app.Service { *; }

# Keep BroadcastReceivers
-keep class * extends android.content.BroadcastReceiver { *; }

# Keep ContentProviders
-keep class * extends android.content.ContentProvider { *; }

# Keep custom Views
-keep public class * extends android.view.View { *; }
-keep public class * extends android.view.ViewGroup { *; }

# ===========================================
# Data Classes & Models
# ===========================================

# Keep data classes used in React Native bridge
-keep class * implements java.io.Serializable { *; }
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !private !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep Parcelable classes (Android IPC)
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep all parcelable classes
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}

# ===========================================
# JSON & Serialization
# ===========================================

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep classes with @SerializedName annotation
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Jackson
-keep class com.fasterxml.jackson.** { *; }
-keepclassmembers class * {
    @com.fasterxml.jackson.annotation.* *;
}

# ===========================================
# Coroutines & RxJava
# ===========================================

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.coroutines.** {
    volatile <fields>;
}

# RxJava
-keep class io.reactivex.** { *; }
-keep interface io.reactivex.** { *; }

# ===========================================
# OkHttp & Retrofit
# ===========================================

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }

# Retrofit
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# ===========================================
# Image Loading Libraries
# ===========================================

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule {
    <init>(...);
}
-keep public enum com.bumptech.glide.load.resource.bitmap.ImageHeaderParser$** {
    **[] $VALUES;
    public *;
}
-keep class com.bumptech.glide.load.data.ParcelFileDescriptorRewinder$InternalRewinder {
    *** rewind(***);
}

# Picasso
-keep class com.squareup.picasso.** { *; }

# Fresco
-keep class com.facebook.fresco.** { *; }

# ===========================================
# Database Libraries
# ===========================================

# Drizzle ORM (if used)
-keep class drizzle.** { *; }

# Realm
-keep class io.realm.** { *; }
-keep @io.realm.annotations.RealmClass class * { *; }

# ===========================================
# Common Libraries
# ===========================================

# Keep all native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JavascriptInterface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ===========================================
# Debug & Build Configuration
# ===========================================

# Remove debug logs in release
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# Keep source file names and line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable

# Keep annotations
-keepattributes *Annotation*

# Keep generic signatures
-keepattributes Signature

# Keep exception info
-keepattributes Exceptions

# ===========================================
# Optimization Settings
# ===========================================

# Enable optimization (1 pass for faster build)
-optimizationpasses 1
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Optimization settings
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*,!code/allocation/variable

# Allow optimization
-allowaccessmodification

# ===========================================
# Warnings to Ignore
# ===========================================

-dontwarn com.facebook.**
-dontwarn com.google.android.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.intellij.lang.annotations.**
-dontwarn org.jetbrains.annotations.**

# ===========================================
# App Package - Keep your app classes
# ===========================================

# Keep your app's package classes
-keep class com.xdl.XLedger.** { *; }

# Keep all BuildConfig classes
-keep class com.xdl.XLedger.BuildConfig { *; }

# ===========================================
# WebView Support
# ===========================================

-keep class android.webkit.** { *; }
-keep class * extends android.webkit.WebViewClient { *; }
-keep class * extends android.webkit.WebChromeClient { *; }

# ===========================================
# Hermes JavaScript Engine
# ===========================================

-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.hermes.intl.** { *; }

# ===========================================
# JSC (JavaScriptCore) - if used
# ===========================================

-keep class com.facebook.jsc.** { *; }
