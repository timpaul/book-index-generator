import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Book, Plus, Eye, Trash2, Upload, FileText, ExternalLink, Search, ChevronRight, Home } from 'lucide-react';

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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob(blob => {
      const reader = new FileReader();
      reader.onload = (e) => processImageData(e.target.result);
      reader.readAsDataURL(blob);
    });
    
    stopCamera();
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
          Book Index Generator
        </h1>
        <button
          onClick={() => setShowNewBookForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          New Book
        </button>
      </div>

      {showNewBookForm && (
        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 mb-6">
          <h3 className="font-semibold mb-3">Create New Book</h3>
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
              Create Book
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
            <h4 className="font-semibold mb-2">Or Import Book</h4>
            <button
              onClick={() => importFileRef.current?.click()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import from JSON file
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
          <div key={book.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
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
              {book.photosProcessed} photos processed
            </p>
            <p className="text-gray-600 text-sm mb-2">
              Created: {new Date(book.createdAt).toLocaleDateString()}
            </p>
            <p className="text-gray-600 text-sm mb-3">
              {Object.keys(book.entries).length} index terms • {Object.keys(book.pages).length} pages
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

    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setView('home')}
            className="text-blue-500 hover:text-blue-700"
          >
            <Home className="w-4 h-4" />
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <h1 className="text-xl font-bold">{book.name}</h1>
        </div>

        <div className="bg-white p-4 rounded-lg border mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Add Index Photos
          </h2>
          
          {processing && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700">{processingStatus}</p>
            </div>
          )}

          {processingStatus && !processing && processingStatus.includes('Error') && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-700">{processingStatus}</p>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={startCamera}
              disabled={processing || cameraActive}
              className="bg-green-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-600 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-600 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Upload Photo
            </button>
          </div>

          {cameraActive && (
            <div className="mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-md border rounded"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={capturePhoto}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Capture
                </button>
                <button
                  onClick={stopCamera}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
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

          <p className="text-sm text-gray-600">
            Photos processed: {book.photosProcessed} • 
            Index terms found: {Object.keys(book.entries).length} • 
            Pages with content: {Object.keys(book.pages).length}
          </p>
        </div>

        {Object.keys(book.pages).length > 0 && (
          <div className="bg-white p-4 rounded-lg border mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generated Pages ({Object.keys(book.pages).length})
            </h2>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Object.keys(book.pages)
                .map(Number)
                .sort((a, b) => a - b)
                .map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setSelectedPage(pageNum);
                      setView('page');
                    }}
                    className="p-3 border rounded-lg hover:bg-blue-50 text-left"
                  >
                    <div className="font-semibold">Page {pageNum}</div>
                    <div className="text-sm text-gray-600">
                      {book.pages[pageNum].length} topics
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Export Book
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

    const PageNavigation = ({ position }) => (
      <div className="flex justify-between items-center mb-4">
        <div>
          {previousPage && (
            <button
              onClick={() => setSelectedPage(previousPage)}
              className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Previous page ({previousPage})
            </button>
          )}
        </div>
        <div>
          {nextPage && (
            <button
              onClick={() => setSelectedPage(nextPage)}
              className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              Next page ({nextPage})
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );

    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
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
          <h1 className="text-xl font-bold">Page {selectedPage}</h1>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Topics on Page {selectedPage}
          </h2>
          
          <PageNavigation position="top" />
          
          {pageTopics.length === 0 ? (
            <p className="text-gray-500 text-center">No topics found for this page.</p>
          ) : (
            <div className="space-y-3">
              {pageTopics.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map(topic => (
                <div key={topic} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <span className="font-medium">{topic}</span>
                  <a
                    href={generateWikipediaUrl(topic)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Wikipedia
                  </a>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t">
            <PageNavigation position="bottom" />
            <p className="text-sm text-gray-600 text-center mt-4">
              Click Wikipedia links to explore these topics in depth
            </p>
          </div>
        </div>
      </div>
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