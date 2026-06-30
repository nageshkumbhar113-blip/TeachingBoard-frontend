# Nks EduOrbit Student App Icons

## Icon Files Needed

Please add the following icon files to this directory:

### Required Sizes

```
ic_launcher_foreground.png    (512x512px) - Main app icon foreground
ic_launcher.png               (192x192px) - Default launcher icon
```

### Optional Additional Sizes

```
ic_launcher_72.png            (72x72px)
ic_launcher_96.png            (96x96px)
ic_launcher_144.png           (144x144px)
```

## Design Requirements

- **Logo**: Nks EduOrbit logo with graduation cap, open book, orbital rings
- **Colors**:
  - Primary: Navy Blue #001F5C
  - Secondary: Cyan #00B4D8
  - Accent: Golden Orange #FFA500
- **Tagline**: "Learn Smart. Achieve More."
- **Style**: Modern, geometric, flat design or gradient
- **Format**: PNG with transparent background

## Configuration

The following files are already configured:

- `ic_launcher_background.xml` - Background color: Navy Blue (#001F5C)
- `strings.xml` - App name: "Nks EduOrbit"

## Splash Screen

The splash screen will automatically use:
- Logo: `../icons/nks-edorbit-logo.png`
- Tagline: "Learn Smart. Achieve More."

## Android Asset Mapping

When building, ensure icons are placed in:
```
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
android/app/src/main/res/mipmap-hdpi/ic_launcher.png
```

The build script will auto-sync these via Capacitor.

## Create Icons

### Option 1: Looka.com (Recommended)
1. Visit https://www.looka.com/
2. Search for "Nks EduOrbit"
3. Download PNG files in required sizes

### Option 2: Canva
1. Visit https://www.canva.com/
2. Create app icon (512x512)
3. Download in multiple sizes

### Option 3: Professional Designer
- Budget: ₹2000-5000
- Deliverables: Icon in 5+ sizes, PNG format, transparent background

## Next Steps

1. Download/create Nks EduOrbit logo
2. Save as PNG files in this directory
3. Run: `.\build-student.bat`
4. Test APK on device

---

**Last Updated:** June 30, 2026
**Version:** 6.0.0
**App ID:** com.nkseduorbit.student
