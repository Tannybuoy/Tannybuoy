import { useState, useRef, useCallback, useEffect } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './App.css'

function App() {
  const [imageUrls, setImageUrls] = useState([''])
  const [images, setImages] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const canvasRef = useRef(null)
  const exportMenuRef = useRef(null)

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleUrlChange = (index, value) => {
    const newUrls = [...imageUrls]
    newUrls[index] = value
    setImageUrls(newUrls)
  }

  const addImageInput = () => {
    setImageUrls([...imageUrls, ''])
  }

  const removeImageInput = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index)
    setImageUrls(newUrls.length ? newUrls : [''])
  }

  const calculateLayout = (count, canvasWidth, canvasHeight) => {
    // Calculate optimal grid layout based on image count
    const layouts = {
      1: { cols: 1, rows: 1 },
      2: { cols: 2, rows: 1 },
      3: { cols: 3, rows: 1 },
      4: { cols: 2, rows: 2 },
      5: { cols: 3, rows: 2 },
      6: { cols: 3, rows: 2 },
      7: { cols: 4, rows: 2 },
      8: { cols: 4, rows: 2 },
      9: { cols: 3, rows: 3 },
      10: { cols: 4, rows: 3 },
      11: { cols: 4, rows: 3 },
      12: { cols: 4, rows: 3 },
    }

    const layout = layouts[count] || {
      cols: Math.ceil(Math.sqrt(count)),
      rows: Math.ceil(count / Math.ceil(Math.sqrt(count)))
    }

    const padding = 10
    const cellWidth = (canvasWidth - padding * (layout.cols + 1)) / layout.cols
    const cellHeight = (canvasHeight - padding * (layout.rows + 1)) / layout.rows

    return { ...layout, cellWidth, cellHeight, padding }
  }

  const createVisionBoard = () => {
    const validUrls = imageUrls.filter(url => url.trim() !== '')
    if (validUrls.length === 0) return

    const canvasWidth = 800
    const canvasHeight = 600
    const layout = calculateLayout(validUrls.length, canvasWidth, canvasHeight)

    const newImages = validUrls.map((url, index) => {
      const row = Math.floor(index / layout.cols)
      const col = index % layout.cols

      return {
        id: Date.now() + index,
        url,
        x: layout.padding + col * (layout.cellWidth + layout.padding),
        y: layout.padding + row * (layout.cellHeight + layout.padding),
        width: layout.cellWidth,
        height: layout.cellHeight,
      }
    })

    setImages(newImages)
    setIsEditing(true)
  }

  const handleMouseDown = (e, image, action) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()

    if (action === 'resize') {
      setResizing({
        id: image.id,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: image.width,
        startHeight: image.height,
      })
    } else {
      setSelectedImage({
        id: image.id,
        offsetX: e.clientX - rect.left - image.x,
        offsetY: e.clientY - rect.top - image.y,
      })
    }
  }

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()

    if (resizing) {
      const deltaX = e.clientX - resizing.startX
      const deltaY = e.clientY - resizing.startY

      setImages(prevImages => prevImages.map(img => {
        if (img.id === resizing.id) {
          const newWidth = Math.max(50, resizing.startWidth + deltaX)
          const newHeight = Math.max(50, resizing.startHeight + deltaY)
          return { ...img, width: newWidth, height: newHeight }
        }
        return img
      }))
    } else if (selectedImage) {
      const newX = e.clientX - rect.left - selectedImage.offsetX
      const newY = e.clientY - rect.top - selectedImage.offsetY

      setImages(prevImages => prevImages.map(img => {
        if (img.id === selectedImage.id) {
          return {
            ...img,
            x: Math.max(0, Math.min(newX, 800 - img.width)),
            y: Math.max(0, Math.min(newY, 600 - img.height)),
          }
        }
        return img
      }))
    }
  }, [selectedImage, resizing])

  const handleMouseUp = useCallback(() => {
    setSelectedImage(null)
    setResizing(null)
  }, [])

  useEffect(() => {
    if (selectedImage || resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [selectedImage, resizing, handleMouseMove, handleMouseUp])

  const exportAs = async (format) => {
    if (!canvasRef.current) return
    setShowExportMenu(false)

    try {
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1a1a2e',
        scale: 2,
      })

      if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height]
        })
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
        pdf.save('visionboard.pdf')
      } else {
        const link = document.createElement('a')
        link.download = `visionboard.${format}`
        link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.9)
        link.click()
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Some images may have CORS restrictions.')
    }
  }

  const resetBoard = () => {
    setImages([])
    setIsEditing(false)
    setImageUrls([''])
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Vision Board Creator</h1>
        <p>Create your personalized vision board with images that inspire you</p>
      </header>

      <main className="main-content">
        {!isEditing ? (
          <div className="input-section">
            <h2>Add Your Images</h2>
            <p className="input-hint">Paste image URLs below to see a preview</p>

            <div className="url-inputs">
              {imageUrls.map((url, index) => (
                <div key={index} className="url-input-row">
                  <div className="input-with-preview">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder="Paste image URL here..."
                      className="url-input"
                    />
                    {url.trim() && (
                      <div className="image-preview">
                        <img
                          src={url}
                          alt="Preview"
                          onError={(e) => e.target.style.display = 'none'}
                          onLoad={(e) => e.target.style.display = 'block'}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => removeImageInput(index)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="input-actions">
              <button className="add-btn" onClick={addImageInput}>
                + Add Another Image
              </button>
              <button
                className="create-btn"
                onClick={createVisionBoard}
                disabled={!imageUrls.some(url => url.trim())}
              >
                Create Visionboard
              </button>
            </div>
          </div>
        ) : (
          <div className="editor-section">
            <div className="editor-toolbar">
              <button className="reset-btn" onClick={resetBoard}>
                ← Start Over
              </button>
              <div className="export-dropdown" ref={exportMenuRef}>
                <button
                  className="export-btn"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  Export ▼
                </button>
                {showExportMenu && (
                  <div className="export-menu">
                    <button onClick={() => exportAs('png')}>
                      Download as PNG
                    </button>
                    <button onClick={() => exportAs('jpg')}>
                      Download as JPG
                    </button>
                    <button onClick={() => exportAs('pdf')}>
                      Download as PDF
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="editor-hint">Drag images to reposition. Drag the corner handle to resize.</p>

            <div
              className="canvas"
              ref={canvasRef}
            >
              {images.map((image) => (
                <div
                  key={image.id}
                  className="canvas-image"
                  style={{
                    left: image.x,
                    top: image.y,
                    width: image.width,
                    height: image.height,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, image, 'move')}
                >
                  <img
                    src={image.url}
                    alt="Vision"
                    draggable={false}
                  />
                  <div
                    className="resize-handle"
                    onMouseDown={(e) => handleMouseDown(e, image, 'resize')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Made and Built with Love and Claude by{' '}
          <span className="author-name">Tanya Gupta</span>
        </p>
        <div className="footer-links">
          <a href="mailto:hello.tanyaa.pm@gmail.com">
            hello.tanyaa.pm@gmail.com
          </a>
          <span className="separator">|</span>
          <a href="https://substack.com/@pmwithtanya" target="_blank" rel="noopener noreferrer">
            Substack
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
