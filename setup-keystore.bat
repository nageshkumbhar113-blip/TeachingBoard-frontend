@echo off
echo ========================================
echo  TeachingBoard — Release Keystore Setup
echo ========================================
echo.
echo  हे फक्त एकदाच run करायचे आहे!
echo  (Run this ONLY ONCE — keep the .jks file safe)
echo.

if exist android\teachingboard.jks (
  echo ⚠️  android\teachingboard.jks already exists!
  echo    Delete it manually if you want to recreate.
  pause & exit /b 0
)

echo Creating keystore: android\teachingboard.jks
echo.
echo  → तुम्हाला खालील गोष्टी विचारल्या जातील:
echo     Keystore password  (लक्षात ठेवा — हरवले तर APK sign होणार नाही)
echo     Key password       (same as keystore password ठेवणे सोपे)
echo     First/Last name    (तुमचे नाव)
echo     Organization       (TeachingBoard)
echo     City, State, Country (तुमचे शहर, राज्य, IN)
echo.
pause

keytool -genkey -v -keystore android\teachingboard.jks -alias teachingboard -keyalg RSA -keysize 2048 -validity 10000

if errorlevel 1 (
  echo.
  echo ERROR: Keystore creation failed.
  echo Make sure Java/JDK is installed: java -version
  pause & exit /b 1
)

echo.
echo ✅ Keystore created: android\teachingboard.jks
echo.
echo  आता android\keystore.properties file तयार करा:
echo  (खाली दिलेले passwords तुमचे actual passwords टाका)
echo.

echo storeFile=../teachingboard.jks> android\keystore.properties.tmp
echo storePassword=YOUR_KEYSTORE_PASSWORD>> android\keystore.properties.tmp
echo keyAlias=teachingboard>> android\keystore.properties.tmp
echo keyPassword=YOUR_KEY_PASSWORD>> android\keystore.properties.tmp

echo  📄 android\keystore.properties.tmp तयार झाले
echo     Rename to keystore.properties आणि passwords बदला:
echo.
echo     storeFile=../teachingboard.jks
echo     storePassword=^^^^YOUR_KEYSTORE_PASSWORD^^^^
echo     keyAlias=teachingboard
echo     keyPassword=^^^^YOUR_KEY_PASSWORD^^^^
echo.
echo  ⚠️  IMPORTANT — या दोन्ही files कधीही git मध्ये commit करू नका:
echo     android\teachingboard.jks
echo     android\keystore.properties
echo.
echo  ✅ Setup complete! आता build-student.bat किंवा build-admin.bat run करा.
pause
