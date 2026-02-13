(function() {
  // Config
  const SCRIPT_TAG = document.currentScript;
  const SRC_URL = new URL(SCRIPT_TAG.src);
  const BASE_URL = SRC_URL.origin;
  const APP_URL = SCRIPT_TAG.getAttribute('data-app-url') || BASE_URL;

  // Append lead source URL to APP_URL
  const leadSourceUrl = encodeURIComponent(window.location.href);
  const targetUrl = new URL(APP_URL);
  
  // Check if APP_URL already has a path, if not append /guest-chat
  // If the user provided a specific URL like http://localhost:5173/guest-chat, use it.
  // Otherwise, if just domain, append /guest-chat
  if (targetUrl.pathname === '/' || targetUrl.pathname === '') {
      targetUrl.pathname = '/guest-chat';
  }
  targetUrl.searchParams.set('lead_source_url', leadSourceUrl);
  
  const FINAL_URL = targetUrl.toString();

  // --- Styles & Constants ---
  const WHATSAPP_GREEN = '#008069';
  const BG_COLOR = '#ffffff';
  const HEADER_BG = '#f0f2f5';
  const Z_INDEX = '2147483647';
  
  // Create Main Container (for isolation)
  const container = document.createElement('div');
  container.id = 'meta-cc-widget-root';
  container.style.position = 'fixed';
  container.style.zIndex = Z_INDEX;
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  container.style.pointerEvents = 'none'; // Let clicks pass through empty areas
  document.body.appendChild(container);

  // --- 1. The Chat Bubble (Launcher) ---
  const launcher = document.createElement('div');
  Object.assign(launcher.style, {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: WHATSAPP_GREEN,
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    pointerEvents: 'auto', // Re-enable clicks
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
    position: 'absolute',
    bottom: '0',
    right: '0'
  });

  // Icon (Chat SVG)
  launcher.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/>
      <path d="M12 6H14V10H12V6ZM12 12H14V18H12V12Z" fill="none"/> 
      <!-- Using a generic chat/info icon for now, can replace with specific paths -->
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/> 
    </svg>
  `;
  
  launcher.onmouseenter = () => launcher.style.transform = 'scale(1.05)';
  launcher.onmouseleave = () => launcher.style.transform = 'scale(1)';

  // --- 2. The Window Frame (Wrapper) ---
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    position: 'fixed', // Fixed relative to viewport
    bottom: '90px',
    right: '20px',
    width: '350px',
    height: '500px',
    backgroundColor: BG_COLOR,
    borderRadius: '12px',
    boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
    display: 'none', // Hidden by default
    flexDirection: 'column',
    overflow: 'hidden',
    pointerEvents: 'auto',
    transition: 'all 0.3s ease',
    border: '1px solid #e0e0e0'
  });

  // --- 3. Header Bar (Maximize/Close) ---
  const header = document.createElement('div');
  Object.assign(header.style, {
    height: '40px',
    backgroundColor: HEADER_BG,
    borderBottom: '1px solid #ddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    userSelect: 'none'
  });

  const title = document.createElement('span');
  title.innerText = 'Meta Command';
  title.style.fontWeight = '600';
  title.style.fontSize = '14px';
  title.style.color = '#333';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';

  // Helper to create header buttons
  const createBtn = (html, titleText) => {
    const b = document.createElement('div');
    b.innerHTML = html;
    b.title = titleText;
    Object.assign(b.style, {
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#666'
    });
    b.onmouseenter = () => b.style.backgroundColor = 'rgba(0,0,0,0.05)';
    b.onmouseleave = () => b.style.backgroundColor = 'transparent';
    return b;
  };

  // Maximize/Restore SVG
  const iconMax = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
  const iconMin = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;
  const iconClose = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const btnMax = createBtn(iconMax, 'Maximize');
  const btnClose = createBtn(iconClose, 'Close');

  controls.appendChild(btnMax);
  controls.appendChild(btnClose);
  header.appendChild(title);
  header.appendChild(controls);

  // --- 4. The Iframe ---
  const iframe = document.createElement('iframe');
  iframe.src = FINAL_URL;
  Object.assign(iframe.style, {
    flex: '1',
    width: '100%',
    border: 'none',
    backgroundColor: '#fff'
  });

  frame.appendChild(header);
  frame.appendChild(iframe);
  container.appendChild(frame); // Frame is child of container (but fixed pos)
  container.appendChild(launcher);

  // --- Logic ---
  let isOpen = false;
  let isMaximized = false;

  // Toggle Open/Close
  const toggleWidget = () => {
    isOpen = !isOpen;
    frame.style.display = isOpen ? 'flex' : 'none';
    // Update launcher icon if needed, but generic chat icon is fine
  };

  launcher.onclick = toggleWidget;
  btnClose.onclick = toggleWidget;

  // Toggle Maximize/Restore
  btnMax.onclick = () => {
    isMaximized = !isMaximized;
    if (isMaximized) {
      // Maximize Styles
      Object.assign(frame.style, {
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        width: '100%',
        height: '100%',
        borderRadius: '0',
        zIndex: Z_INDEX // Ensure on top
      });
      btnMax.innerHTML = iconMin;
      btnMax.title = 'Restore';
    } else {
      // Restore Styles
      Object.assign(frame.style, {
        top: 'auto',
        left: 'auto',
        right: '20px',
        bottom: '90px',
        width: '400px',
        height: '600px',
        borderRadius: '12px'
      });
      btnMax.innerHTML = iconMax;
      btnMax.title = 'Maximize';
    }
  };

})();
