import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Book, Plus, Eye, Trash2, Upload, FileText, ExternalLink, Search, ChevronRight, ArrowRight, Home } from 'lucide-react';

const BookIndexGenerator = () => {
  const [books, setBooks] = useState({});
  const [currentBookId, setCurrentBookId] = useState(null);
  const [view, setView] = useState('home'); // 'home', 'book', 'page'
  const [selectedPage, setSelectedPage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [cameraActive, setCameraActive] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [showNewBookForm, setShowNewBookForm] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [importingBook, setImportingBook] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('topics');

  const importFileRef = useRef();

  // Local storage keys
  const STORAGE_KEY = 'book-index-generator-books';
  const CURRENT_BOOK_KEY = 'book-index-generator-current-book';

  // Load data from local storage on component mount
  useEffect(() => {
    try {
      const savedBooks = localStorage.getItem(STORAGE_KEY);
      const savedCurrentBook = localStorage.getItem(CURRENT_BOOK_KEY);
      
      if (savedBooks) {
        const parsedBooks = JSON.parse(savedBooks);
        setBooks(parsedBooks);
      }
      
      if (savedCurrentBook && savedBooks) {
        const parsedBooks = JSON.parse(savedBooks);
        // Only set current book if it still exists
        if (parsedBooks[savedCurrentBook]) {
          setCurrentBookId(savedCurrentBook);
        }
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      // If there's an error, start fresh
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_BOOK_KEY);
    } finally {
      // Mark initial load as complete
      setIsInitialLoad(false);
    }
  }, []);

  // Save books to local storage whenever books state changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad) return; // Don't save during initial load
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch (error) {
      console.error('Error saving books to localStorage:', error);
    }
  }, [books, isInitialLoad]);

  // Save current book ID to local storage whenever it changes
  useEffect(() => {
    try {
      if (currentBookId) {
        localStorage.setItem(CURRENT_BOOK_KEY, currentBookId);
      } else {
        localStorage.removeItem(CURRENT_BOOK_KEY);
      }
    } catch (error) {
      console.error('Error saving current book to localStorage:', error);
    }
  }, [currentBookId]);

  useEffect(() => {
    if (view === 'page') {
      window.scrollTo(0, 0);
    }
  }, [view, selectedPage]);

  // Load active tab from localStorage
useEffect(() => {
  try {
    const savedTab = localStorage.getItem('book-index-generator-active-tab');
    if (savedTab && ['topics', 'notes', 'gallery'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  } catch (error) {
    console.error('Error loading active tab from localStorage:', error);
  }
}, []);

// Save active tab to localStorage
useEffect(() => {
  try {
    localStorage.setItem('book-index-generator-active-tab', activeTab);
  } catch (error) {
    console.error('Error saving active tab to localStorage:', error);
  }
}, [activeTab]);

  // Updated OCR function to use backend API
  const claudeOCR = async (imageData) => {
    try {
      // Convert data URL to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Create FormData for API request
      const formData = new FormData();
      formData.append('image', blob, 'index-photo.jpg');

      // Call backend API
      const apiResponse = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const result = await apiResponse.json();
      
      if (!result.success) {
        throw new Error(result.error || 'OCR processing failed');
      }

      return result.extractedText;
    } catch (error) {
      console.error('Claude OCR Error:', error);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  };

  const parseIndexText = (text) => {
    const entries = {};
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const match = line.match(/^([^,]+),\s*(.+)$/);
      if (match) {
        const term = match[1].trim();
        const pageNumbers = match[2].split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        if (pageNumbers.length > 0) {
          entries[term] = pageNumbers;
        }
      }
    });
    
    return entries;
  };

  const createBook = () => {
    const bookId = Date.now().toString();
    const bookName = newBookName.trim() || `Book ${Object.keys(books).length + 1}`;
    
    setBooks(prev => ({
      ...prev,
      [bookId]: {
        id: bookId,
        name: bookName,
        entries: {},
        pages: {},
        notes: {},
        createdAt: new Date().toISOString(),
        photosProcessed: 0
      }
    }));
    
    setCurrentBookId(bookId);
    setNewBookName('');
    setShowNewBookForm(false);
    setView('book');
  };

  const exportBook = (bookId) => {
    const book = books[bookId];
    if (!book) return;
    
    const bookData = {
      [bookId]: book
    };
    
    const dataStr = JSON.stringify(bookData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${book.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate the imported data structure
        if (typeof importedData !== 'object' || importedData === null) {
          throw new Error('Invalid file format');
        }
        
        // Get the first (and presumably only) book from the imported data
        const bookIds = Object.keys(importedData);
        if (bookIds.length === 0) {
          throw new Error('No book data found in file');
        }
        
        const bookId = bookIds[0];
        const bookData = importedData[bookId];
        
        // Validate book data structure
        if (!bookData || typeof bookData !== 'object' || !bookData.id || !bookData.name) {
          throw new Error('Invalid book data structure');
        }
        
        // Check if book with same ID already exists
        if (books[bookId]) {
          setImportingBook({ bookId, bookData });
          setShowImportConfirm(true);
        } else {
          // Import the book directly
          importBook(bookId, bookData);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert(`Failed to import book: ${error.message}`);
      }
    };
    
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  const importBook = (bookId, bookData) => {
    setBooks(prev => ({
      ...prev,
      [bookId]: {
        ...bookData,
        // Ensure required fields exist
        entries: bookData.entries || {},
        pages: bookData.pages || {},
        notes: bookData.notes || {},
        photosProcessed: bookData.photosProcessed || 0,
        createdAt: bookData.createdAt || new Date().toISOString()
      }
    }));
    
    // Set as current book and navigate to it
    setCurrentBookId(bookId);
    setView('book');
    setShowNewBookForm(false);
    setNewBookName('');
    
    alert(`Book "${bookData.name}" imported successfully!`);
  };

  const confirmImport = () => {
    if (importingBook) {
      importBook(importingBook.bookId, importingBook.bookData);
    }
    setShowImportConfirm(false);
    setImportingBook(null);
  };

  const cancelImport = () => {
    setShowImportConfirm(false);
    setImportingBook(null);
  };

  const processImageData = async (imageData) => {
    if (!currentBookId) return;
    
    setProcessing(true);
    setProcessingStatus('Sending image to Claude for OCR...');
    
    try {
      const extractedText = await claudeOCR(imageData);
      setProcessingStatus('Parsing index entries...');
      
      const newEntries = parseIndexText(extractedText);
      
      setProcessingStatus('Updating book data...');
      
      setBooks(prev => {
        const book = prev[currentBookId];
        const updatedEntries = { ...book.entries };
        const updatedPages = { ...book.pages };
        
        // Merge new entries with existing ones
        Object.entries(newEntries).forEach(([term, pageNumbers]) => {
          if (updatedEntries[term]) {
            // Merge page numbers, avoiding duplicates
            const existingPages = new Set(updatedEntries[term]);
            pageNumbers.forEach(page => existingPages.add(page));
            updatedEntries[term] = Array.from(existingPages).sort((a, b) => a - b);
          } else {
            updatedEntries[term] = pageNumbers;
          }
        });
        
        // Update pages structure
        Object.entries(updatedEntries).forEach(([term, pageNumbers]) => {
          pageNumbers.forEach(pageNum => {
            if (!updatedPages[pageNum]) {
              updatedPages[pageNum] = [];
            }
            if (!updatedPages[pageNum].includes(term)) {
              updatedPages[pageNum].push(term);
            }
          });
        });
        
        return {
          ...prev,
          [currentBookId]: {
            ...book,
            entries: updatedEntries,
            pages: updatedPages,
            photosProcessed: book.photosProcessed + 1
          }
        };
      });
      
      setProcessingStatus('Complete!');
      setTimeout(() => setProcessingStatus(''), 2000);
    } catch (error) {
      setProcessingStatus(`Error: ${error.message}`);
      console.error('OCR Error:', error);
      setTimeout(() => setProcessingStatus(''), 5000);
    } finally {
      setProcessing(false);
    }
  };

const startCamera = async () => {
  try {
    // Check if we're on HTTPS or localhost
    const isSecureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecureContext) {
      throw new Error('Camera access requires HTTPS or localhost');
    }

    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }

    setCameraLoading(true);
    setProcessingStatus('Requesting camera permission...');
    
    // Request camera permission with fallback constraints
    let stream;
    try {
      // Try with environment camera first (back camera on mobile)
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
    } catch (envCameraError) {
      console.log('Environment camera failed, trying default camera:', envCameraError);
      // Fallback to any available camera
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
    }

    // Set camera active to render the video element
    setCameraActive(true);
    
    // Wait for the video element to be rendered
    await new Promise((resolve) => {
      const checkVideoElement = () => {
        if (videoRef.current) {
          resolve();
        } else {
          // Keep checking until video element is available
          setTimeout(checkVideoElement, 50);
        }
      };
      checkVideoElement();
    });

    // Now set up video stream
    videoRef.current.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Video failed to load within 10 seconds'));
      }, 10000);

      videoRef.current.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      
      videoRef.current.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Video element error'));
      };
    });

    setProcessingStatus('Camera ready!');
    setTimeout(() => setProcessingStatus(''), 2000);
    
  } catch (error) {
    console.error('Camera access error:', error);
    
    // Clean up on error
    setCameraActive(false);
    
    // Provide more specific error messages
    let errorMessage = 'Camera access failed: ';
    
    if (error.name === 'NotAllowedError') {
      errorMessage += 'Camera permission was denied. Please allow camera access and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'No camera found on this device.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage += 'Camera is not supported on this device.';
    } else if (error.name === 'NotReadableError') {
      errorMessage += 'Camera is being used by another application.';
    } else if (error.message.includes('HTTPS')) {
      errorMessage += 'Camera requires HTTPS connection. Please use HTTPS or localhost.';
    } else {
      errorMessage += error.message;
    }
    
    setProcessingStatus(`Error: ${errorMessage}`);
    setTimeout(() => setProcessingStatus(''), 8000);
  } finally {
    setCameraLoading(false);
  }
};

// Updated stopCamera function
const stopCamera = () => {
  try {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
    setProcessingStatus('');
  } catch (error) {
    console.error('Error stopping camera:', error);
  }
};

// Enhanced capturePhoto function with better error handling
const capturePhoto = () => {
  try {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) {
      throw new Error('Canvas or video element not available');
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Video not ready - no video dimensions');
    }
    
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the video frame to canvas
    context.drawImage(video, 0, 0);
    
    // Convert to blob and process
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          throw new Error('Failed to capture image');
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          processImageData(e.target.result);
        };
        reader.onerror = () => {
          setProcessingStatus('Error: Failed to process captured image');
          setTimeout(() => setProcessingStatus(''), 5000);
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      0.8 // Quality setting
    );
    
    stopCamera();
    
  } catch (error) {
    console.error('Photo capture error:', error);
    setProcessingStatus(`Error capturing photo: ${error.message}`);
    setTimeout(() => setProcessingStatus(''), 5000);
  }
};

// Optional: Add a function to check camera permissions
const checkCameraPermission = async () => {
  try {
    if (!navigator.permissions) {
      return 'unknown';
    }
    
    const result = await navigator.permissions.query({ name: 'camera' });
    return result.state; // 'granted', 'denied', or 'prompt'
  } catch (error) {
    console.error('Permission check error:', error);
    return 'unknown';
  }
};

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => processImageData(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const deleteBook = (bookId) => {
    setBooks(prev => {
      const updated = { ...prev };
      delete updated[bookId];
      return updated;
    });
    if (currentBookId === bookId) {
      setCurrentBookId(null);
      setView('home');
    }
  };

  const generateWikipediaUrl = (term) => {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(term.replace(/\s+/g, '_'))}`;
  };

  const renderHome = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Book className="w-6 h-6" />
          Booky
        </h1>
        <button
          onClick={() => setShowNewBookForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          New book
        </button>
      </div>

      {showNewBookForm && (
        <div className="bg-white p-4 border-2 border-blue-200 mb-6">
          <h3 className="font-semibold mb-3">Create new book</h3>
          <input
            type="text"
            placeholder="Book name (optional)"
            value={newBookName}
            onChange={(e) => setNewBookName(e.target.value)}
            className="w-full p-2 border rounded mb-3"
          />
          <div className="flex gap-2 mb-4">
            <button
              onClick={createBook}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Create book
            </button>
            <button
              onClick={() => {
                setShowNewBookForm(false);
                setNewBookName('');
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Or import book</h4>
            <button
              onClick={() => importFileRef.current?.click()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import book from JSON file
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
            <p className="text-sm text-gray-600 mt-2">
              Select a JSON file exported from this app
            </p>
          </div>
        </div>
      )}

      {showImportConfirm && importingBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="font-semibold text-lg mb-4">Book Already Exists</h3>
            <p className="text-gray-600 mb-4">
              A book with the same ID already exists: <strong>"{books[importingBook.bookId]?.name}"</strong>
            </p>
            <p className="text-gray-600 mb-6">
              Do you want to replace it with the imported book: <strong>"{importingBook.bookData.name}"</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmImport}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Replace Existing Book
              </button>
              <button
                onClick={cancelImport}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.values(books).map(book => (
          <div key={book.id} className="bg-white p-4 -lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg">{book.name}</h3>
              <button
                onClick={() => deleteBook(book.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              Created on {new Date(book.createdAt).toLocaleDateString()}
            </p>
            <p className="text-gray-600 text-sm mb-3">
              {Object.keys(book.entries).length} topics in {Object.keys(book.pages).length} pages from {book.photosProcessed} photos
            </p>
            <button
              onClick={() => {
                setCurrentBookId(book.id);
                setView('book');
              }}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              View Book
            </button>
          </div>
        ))}
      </div>

      {Object.keys(books).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Book className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No books yet</p>
          <p>Create your first book to get started!</p>
        </div>
      )}
    </div>
  );

const renderBook = () => {
  const book = books[currentBookId];
  if (!book) return null;

  // Filter pages based on search query
  const filteredPages = Object.keys(book.pages).filter(pageNum => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Check if query is a number - if so, do exact page number matching
    if (/^\d+$/.test(query)) {
      return pageNum === query;
    }
    
    // For non-numeric queries, check if any topic on this page matches
    const pageTopics = book.pages[pageNum] || [];
    return pageTopics.some(topic => 
      topic.toLowerCase().includes(query)
    );
  });

  return (
    <div className="">
      <div className="flex items-center gap-2 mb-1 p-4">
        <button
          onClick={() => setView('home')}
          className="text-blue-500 hover:text-blue-700"
        >
          <Home className="w-4 h-4" />
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <h1 className="text-l font-bold">{book.name}</h1>
      </div>

 

      {Object.keys(book.pages).length > 0 && (
        <div className="mb-6">
          {/* Search box */}
          <div className="mx-4 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by page number or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>

            <p className="text-gray-600 text-sm text-center mt-3">
              {Object.keys(book.entries).length} topics in {Object.keys(book.pages).length} pages
            </p>

          </div>

          <div className="bg-white grid border-t md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPages.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No pages found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredPages
                .map(Number)
                .sort((a, b) => a - b)
                .map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setSelectedPage(pageNum);
                      setView('page');
                    }}
                    className="p-4 border-b hover:bg-blue-50 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Page {pageNum}</span>
                      <span className="text-sm text-gray-600">
                        {book.pages[pageNum].length} topics
                      </span>
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>
      )}

           <div className="bg-white p-4 border-t border-b mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Add index photos
        </h2>

        <p className="text-gray-600 text-sm mb-4">
          {Object.keys(book.entries).length} topics in {Object.keys(book.pages).length} pages from {book.photosProcessed} photos
        </p>
        
        {processing && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200">
            <p className="text-blue-700">{processingStatus}</p>
          </div>
        )}

        {processingStatus && !processing && processingStatus.includes('Error') && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200">
            <p className="text-red-700">{processingStatus}</p>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={startCamera}
            disabled={processing || cameraActive || cameraLoading}
            className="bg-green-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-600 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {cameraLoading ? 'Starting Camera...' : 'Take Photo'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="bg-blue-500 text-white px-4 py-2 flex items-center rounded gap-2 hover:bg-blue-600 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload photos
          </button>
        </div>

        {(cameraActive || cameraLoading) && (
          <div className="mb-4">
            {cameraLoading && (
              <div className="w-full max-w-md border bg-gray-100 flex items-center justify-center h-48">
                <p className="text-gray-600">Starting camera...</p>
              </div>
            )}
            {cameraActive && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-md border"
              />
            )}
            <div className="flex gap-2 mt-2">
              {cameraActive && (
                <button
                  onClick={capturePhoto}
                  className="bg-green-500 text-white px-4 py-2 hover:bg-green-600"
                >
                  Capture
                </button>
              )}
              <button
                onClick={stopCamera}
                className="bg-gray-500 text-white px-4 py-2 hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="bg-white p-4 border-t">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Export book
        </h2>
        <p className="text-gray-600 text-sm mb-3">
          Export this book's data as a JSON file to share or backup your index data.
        </p>
        <button
          onClick={() => exportBook(currentBookId)}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Export Book Data
        </button>
      </div>
    </div>
  );
};

const renderPage = () => {
  const book = books[currentBookId];
  if (!book || !selectedPage) return null;

  const pageTopics = book.pages[selectedPage] || [];
  const allPageNumbers = Object.keys(book.pages).map(Number).sort((a, b) => a - b);
  const currentPageIndex = allPageNumbers.indexOf(selectedPage);
  const previousPage = currentPageIndex > 0 ? allPageNumbers[currentPageIndex - 1] : null;
  const nextPage = currentPageIndex < allPageNumbers.length - 1 ? allPageNumbers[currentPageIndex + 1] : null;

  const PageNavigation = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex justify-between items-center py-3 max-w-4xl mx-auto">
        <div>
          {previousPage && (
            <button
              onClick={() => setSelectedPage(previousPage)}
              className="text-blue-500 font-bold hover:text-blue-700 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-blue-50"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Prev
            </button>
          )}
        </div>
        <div className="text-sm text-gray-600 font-medium">
          Page {selectedPage} of {allPageNumbers.length}
        </div>
        <div>
          {nextPage && (
            <button
              onClick={() => setSelectedPage(nextPage)}
              className="text-blue-500 font-bold hover:text-blue-700 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-blue-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const TopicsTab = () => (
    <div className="bg-white">
          {pageTopics.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map(topic => (
            <a
              key={topic}
              href={generateWikipediaUrl(topic)}
              rel="noopener noreferrer"
              className="block p-4 border-b transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 hover:text-gray-900">{topic}</span>
                <div className="bg-blue-500 rounded-full p-1 flex items-center justify-center w-6 h-6">            
                  <ArrowRight className="w-10 h-10 text-white" />
                </div>
              </div>
            </a>
          ))}
          <p className="pt-4 text-sm text-center text-gray-500 bg-gray-50">Topics link to Wikipedia</p>
    </div>
  );

const NotesTab = () => {
  const [localNotes, setLocalNotes] = useState(book.notes?.[selectedPage] || '');
  const timeoutRef = useRef(null);
  
  // Update local state when page changes
  useEffect(() => {
    setLocalNotes(book.notes?.[selectedPage] || '');
  }, [selectedPage, book.notes]);
  
  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setLocalNotes(newNotes); // Update local state immediately for responsive typing
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout to save after user stops typing
    timeoutRef.current = setTimeout(() => {
      setBooks(prev => ({
        ...prev,
        [currentBookId]: {
          ...prev[currentBookId],
          notes: {
            ...prev[currentBookId].notes,
            [selectedPage]: newNotes
          }
        }
      }));
    }, 5000); // Save 5000ms after user stops typing
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white border-b min-h-64">
      <div className="p-4">
        <textarea
          value={localNotes}
          onChange={handleNotesChange}
          placeholder="Enter your notes for this page..."
          className="w-full h-64 p-3 border border-gray-300 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </div>
    </div>
  );
};

  const GalleryTab = () => (
    <div className="bg-white border-b min-h-64">
      <div className="p-8 text-center text-gray-500">
        <p>Gallery feature coming soon...</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="pb-20">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 mb-1">
          <button
            onClick={() => setView('home')}
            className="text-blue-500 hover:text-blue-700"
          >
            <Home className="w-4 h-4" />
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setView('book')}
            className="text-blue-500 hover:text-blue-700"
          >
            {book.name}
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <h1 className="text-l font-bold">Page {selectedPage}</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white sticky top-0 z-40 border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('topics')}
              className={`flex-1 py-3 font-medium border border-b-2 transition-colors ${
                activeTab === 'topics'
                  ? 'text-blue-600 border-b-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 bg-gray-50'
              }`}
            >
              Topics
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-3 font-medium border border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'text-blue-600 border-b-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 bg-gray-50'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`flex-1 py-3 font-medium border border-b-2 transition-colors ${
                activeTab === 'gallery'
                  ? 'text-blue-600 border-b-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 bg-gray-50'
              }`}
            >
              Gallery
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'topics' && <TopicsTab />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'gallery' && <GalleryTab />}
      </div>
      
      {/* Fixed navigation at bottom */}
      <PageNavigation />
    </>
  );
};

  return (
    <div className="min-h-screen bg-gray-50">
      {view === 'home' && renderHome()}
      {view === 'book' && renderBook()}
      {view === 'page' && renderPage()}
    </div>
  );
};

export default BookIndexGenerator;