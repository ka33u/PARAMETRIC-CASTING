import Foundation
import Vision
import AppKit
import ImageIO

struct TextItem: Codable { let text: String; let confidence: Float; let x: Double; let y: Double; let width: Double; let height: Double }
struct Output: Codable { let width: Int; let height: Int; let items: [TextItem] }
do {
 guard CommandLine.arguments.count == 2, let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw NSError(domain: "DrawingOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取图片，请使用 PNG 或 JPG。"] ) }
 let request = VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["zh-Hans", "en-US"]
 request.usesLanguageCorrection = false
 request.minimumTextHeight = 0.004
 request.customWords = ["外径", "内径", "壁厚", "长度", "总长", "高度", "毛坯", "HT200", "HT250"]
 let handler = VNImageRequestHandler(cgImage: image, options: [:])
 try handler.perform([request])
 let items = (request.results ?? []).compactMap { result -> TextItem? in
  guard let candidate = result.topCandidates(1).first else { return nil }
  let b = result.boundingBox
  return TextItem(text: candidate.string, confidence: candidate.confidence, x: b.minX, y: 1-b.maxY, width: b.width, height: b.height)
 }
 let data = try JSONEncoder().encode(Output(width: image.width, height: image.height, items: items))
 FileHandle.standardOutput.write(data)
} catch {
 FileHandle.standardError.write(Data(error.localizedDescription.utf8))
 exit(1)
}
