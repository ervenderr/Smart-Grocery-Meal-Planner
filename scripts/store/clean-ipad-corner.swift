// Paints over the iPadOS window-resize grip (bottom-right corner arc) that Simulator captures include.
// It is system chrome, not app content. Usage: swiftc/ swift clean-ipad-corner.swift <png>...
import AppKit
import CoreGraphics
import ImageIO

for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("read \(path)") }
    let w = img.width, h = img.height
    let space = img.colorSpace ?? CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("ctx") }
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    // Copy the (arc-free) patch directly above the corner down over it, so gradients and dimming match.
    let size = 130
    guard let patch = img.cropping(to: CGRect(x: w - size, y: h - 2 * size, width: size, height: size)) else { fatalError("crop") }
    // CGContext origin is bottom-left: the bottom-right corner is y = 0.
    ctx.draw(patch, in: CGRect(x: w - size, y: 0, width: size, height: size))
    guard let out = ctx.makeImage(), let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else { fatalError("write") }
    CGImageDestinationAddImage(dest, out, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("finalize") }
}
