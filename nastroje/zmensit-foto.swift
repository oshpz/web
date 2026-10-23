// Zmenšení fotky pro B15 (nastroje/joomla-zpracovat.mjs): delší strana nejvýš MAX px, JPEG, bez metadat (EXIF, GPS se nekopírují),
// otočení podle EXIF orientace, průhlednost na bílém pozadí. Použití: zmensit-foto <vstup> <výstup.jpg> [max=1600] [kvalita=0.82]
// Vypíše „šířka výška nová_šířka nová_výška“ původního a nového obrázku; kód 2 = nejde přečíst jako obrázek.
import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 3 else { FileHandle.standardError.write("Použití: zmensit-foto vstup vystup.jpg [max] [kvalita]\n".data(using: .utf8)!); exit(1) }
let maxPx = a.count > 3 ? Int(a[3]) ?? 1600 : 1600
let kvalita = a.count > 4 ? Double(a[4]) ?? 0.82 : 0.82
guard let zdroj = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let vl = CGImageSourceCopyPropertiesAtIndex(zdroj, 0, nil) as? [CFString: Any],
      let w = vl[kCGImagePropertyPixelWidth] as? Int, let h = vl[kCGImagePropertyPixelHeight] as? Int else { exit(2) }
let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                             kCGImageSourceThumbnailMaxPixelSize: min(maxPx, max(w, h)), kCGImageSourceShouldCacheImmediately: true]
guard let obr = CGImageSourceCreateThumbnailAtIndex(zdroj, 0, opts as CFDictionary) else { exit(2) }
// bílé pozadí (PNG s průhledností) a sRGB
let ctx = CGContext(data: nil, width: obr.width, height: obr.height, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: obr.width, height: obr.height))
ctx.draw(obr, in: CGRect(x: 0, y: 0, width: obr.width, height: obr.height))
guard let hotovo = ctx.makeImage(),
      let cil = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { exit(3) }
CGImageDestinationAddImage(cil, hotovo, [kCGImageDestinationLossyCompressionQuality: kvalita] as CFDictionary) // jen kvalita – žádná metadata
guard CGImageDestinationFinalize(cil) else { exit(3) }
print("\(w) \(h) \(hotovo.width) \(hotovo.height)")
