import org.gradle.api.tasks.compile.JavaCompile

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.crisisconnect.citizen"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.crisisconnect.citizen"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

// amplify_db_common is Kotlin-only; ensure its classes exist before javac compiles
// GeneratedPluginRegistrant.java (avoids intermittent "cannot find symbol AmplifyDbCommonPlugin").
afterEvaluate {
    tasks.withType<JavaCompile>().configureEach {
        val match = Regex("^compile(.+)JavaWithJavac$").find(name) ?: return@configureEach
        val variant = match.groupValues[1]
        val kotlinCompile = rootProject.tasks.findByPath(":amplify_db_common:compile${variant}Kotlin")
        if (kotlinCompile != null) {
            dependsOn(kotlinCompile)
        }
    }
}
