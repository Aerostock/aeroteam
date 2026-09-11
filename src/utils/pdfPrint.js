// Télécharge le contenu d'un PDF (jsPDF) au format JPEG (rendu image)
export function downloadPdfAsJpeg(doc, filename) {
  try {
    const canvas = doc.output('canvas')
    const url = canvas.toDataURL('image/jpeg', 0.92)
    const a = document.createElement('a')
    a.href = url
    a.download = (filename || 'document.pdf').replace(/\.pdf$/i, '') + '.jpg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch {
    alert("Export JPEG indisponible dans ce navigateur — utilisez l'export PDF.")
  }
}

// Imprime un PDF généré (jsPDF) via le visionneur du navigateur,
// au lieu d'une capture d'écran de la page.
export function openPdfPrint(doc) {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      // visionneur indisponible : on ouvre le PDF dans un onglet
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
  }
  iframe.src = url
  document.body.appendChild(iframe)
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    URL.revokeObjectURL(url)
  }, 120000)
}