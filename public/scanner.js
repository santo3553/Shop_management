/* =========================================================
   BIPLOB SHOP - MOBILE CAMERA BARCODE & IMEI SCANNER
   Uses HTML5 MediaDevices & BarcodeDetector API for fast
   camera scanning on Android phones and tablets.
========================================================= */

const CameraScanner = {
  stream: null,
  videoEl: null,
  track: null,
  detector: null,
  scanning: false,
  torchActive: false,
  facingMode: 'environment',
  onScanCallback: null,

  async init() {
    this.videoEl = document.getElementById('cameraScannerVideo');
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        this.detector = new BarcodeDetector({
          formats: supported.length > 0 ? supported : [
            'code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39', 'code_93', 'data_matrix'
          ]
        });
      } catch (_) {
        this.detector = null;
      }
    }
  },

  async open(callback, title = 'Scan Barcode / IMEI') {
    this.onScanCallback = callback;
    const modal = document.getElementById('modalCameraScanner');
    const titleEl = document.getElementById('cameraScannerTitle');
    const statusEl = document.getElementById('cameraScannerStatus');
    if (titleEl) titleEl.textContent = title;
    if (statusEl) statusEl.textContent = 'Starting camera...';

    if (modal) modal.showModal();

    if (!this.detector) {
      await this.init();
    }

    try {
      await this.startStream();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = '❌ Camera permission denied or not available. Please allow camera access in your phone settings.';
      }
    }
  },

  async startStream() {
    this.stopStream();
    const statusEl = document.getElementById('cameraScannerStatus');

    const constraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.videoEl.srcObject = this.stream;
    await this.videoEl.play();

    this.track = this.stream.getVideoTracks()[0];
    this.scanning = true;

    // Check torch support
    const torchBtn = document.getElementById('btnScannerTorch');
    if (torchBtn) {
      const caps = this.track.getCapabilities ? this.track.getCapabilities() : {};
      if (caps.torch) {
        torchBtn.classList.remove('hidden');
      } else {
        torchBtn.classList.add('hidden');
      }
    }

    if (statusEl) {
      statusEl.textContent = 'Center barcode or IMEI box inside the guide frame';
    }

    this.scanLoop();
  },

  stopStream() {
    this.scanning = false;
    if (this.track) {
      try {
        if (this.torchActive) {
          this.track.applyConstraints({ advanced: [{ torch: false }] });
        }
      } catch (_) {}
      this.track.stop();
      this.track = null;
    }
    if (this.stream) {
      if (typeof this.stream.getTracks === 'function') {
        (this.stream.getTracks() || []).forEach(t => t.stop());
      }
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.torchActive = false;
    const torchBtn = document.getElementById('btnScannerTorch');
    if (torchBtn) torchBtn.textContent = '🔦 Flashlight';
  },

  close() {
    this.stopStream();
    const modal = document.getElementById('modalCameraScanner');
    if (modal) modal.close();
  },

  async toggleTorch() {
    if (!this.track) return;
    try {
      this.torchActive = !this.torchActive;
      await this.track.applyConstraints({
        advanced: [{ torch: this.torchActive }]
      });
      const torchBtn = document.getElementById('btnScannerTorch');
      if (torchBtn) {
        torchBtn.textContent = this.torchActive ? '💡 Flash ON' : '🔦 Flashlight';
        torchBtn.className = this.torchActive
          ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-gray-900 shadow transition'
          : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-white shadow hover:bg-gray-700 transition';
      }
    } catch (_) {}
  },

  switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.startStream().catch(() => {});
  },

  async scanLoop() {
    if (!this.scanning) return;

    if (this.detector && this.videoEl && this.videoEl.readyState >= 2) {
      try {
        const barcodes = await this.detector.detect(this.videoEl);
        if (barcodes.length > 0) {
          const rawVal = barcodes[0].rawValue ? barcodes[0].rawValue.trim() : '';
          if (rawVal) {
            this.handleDetectedCode(rawVal);
            return;
          }
        }
      } catch (_) {}
    }

    if (this.scanning) {
      requestAnimationFrame(() => this.scanLoop());
    }
  },

  handleDetectedCode(code) {
    if (typeof playBeep === 'function') {
      playBeep(1200, 'triangle', 0.12);
    }
    this.close();

    if (typeof this.onScanCallback === 'function') {
      this.onScanCallback(code);
    }
  }
};

window.CameraScanner = CameraScanner;
