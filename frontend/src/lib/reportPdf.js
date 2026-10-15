function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

export async function embedReportFonts(pdf, fetchFont = fetch) {
  const fontFiles = [
    ['NotoSans-Regular.ttf', 'normal'],
    ['NotoSans-Bold.ttf', 'bold'],
  ]
  const fonts = await Promise.all(fontFiles.map(async ([file, style]) => {
    const response = await fetchFont(`/fonts/${file}`)
    if (!response.ok) throw new Error(`Failed to load report font: ${file} (${response.status})`)
    return { file, style, base64: arrayBufferToBase64(await response.arrayBuffer()) }
  }))

  for (const { file, style, base64 } of fonts) {
    pdf.addFileToVFS(file, base64)
    pdf.addFont(file, 'NotoSans', style)
  }
}
