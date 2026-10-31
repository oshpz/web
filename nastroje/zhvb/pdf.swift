import PDFKit
import AppKit
// použití: pdf text <soubor> <od> <do>   |   pdf render <soubor> <strana> <měřítko> <výstup.png>
let a = CommandLine.arguments
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[2])) else { print("nelze otevřít"); exit(1) }
if a[1] == "text" {
  for i in (Int(a[3])!)...(Int(a[4])!) { print("=== strana \(i) ==="); print(doc.page(at: i - 1)?.string ?? "") }
} else if a[1] == "pocet" { print(doc.pageCount)
} else {
  let p = doc.page(at: Int(a[3])! - 1)!, sc = CGFloat(Double(a[4])!), r = p.bounds(for: .mediaBox)
  let w = Int(r.width * sc), h = Int(r.height * sc)
  let cs = CGColorSpaceCreateDeviceRGB()
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.scaleBy(x: sc, y: sc); ctx.translateBy(x: -r.origin.x, y: -r.origin.y)
  p.draw(with: .mediaBox, to: ctx)
  let img = ctx.makeImage()!, rep = NSBitmapImageRep(cgImage: img)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[5]))
  print("\(w)x\(h)")
}
