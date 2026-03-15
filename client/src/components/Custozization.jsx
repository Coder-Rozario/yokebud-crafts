import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUpload,
  FiType,
  FiGrid,
  FiShoppingBag,
  FiTrash2,
  FiRotateCw,
  FiLayers,
  FiCheck,
  FiChevronLeft,
  FiShare2,
} from "react-icons/fi";

// --- Mock Data (Replace with API Data) ---
const PRODUCTS = [
  {
    id: 1,
    name: "Premium Cotton Hoodie",
    basePrice: 45.0,
    colors: [
      { name: "Midnight Black", hex: "#18181B", image: "https://i.ibb.co/5GzXkxd/black-hoodie-mockup.png" }, // Replace with actual transparent BG hoodie image
      { name: "Heather Grey", hex: "#A1A1AA", image: "https://i.ibb.co/Vt7r46P/grey-hoodie-mockup.png" },
      { name: "Navy Blue", hex: "#1E3A8A", image: "https://i.ibb.co/M9nNq1k/navy-hoodie-mockup.png" },
    ],
  },
  {
    id: 2,
    name: "Classic Crew T-Shirt",
    basePrice: 25.0,
    colors: [
      { name: "White", hex: "#FFFFFF", image: "https://i.ibb.co/GV28p5W/white-tshirt-mockup.png" },
      { name: "Black", hex: "#000000", image: "https://i.ibb.co/5GzXkxd/black-hoodie-mockup.png" }, // Placeholder
    ],
  },
];

const PREMIUM_ASSETS = [
  { id: 101, name: "Yokebud Golden Crest", price: 5.0, url: "https://cdn-icons-png.flaticon.com/512/3522/3522666.png" },
  { id: 102, name: "Vintage Eagle", price: 8.0, url: "https://cdn-icons-png.flaticon.com/512/2855/2855768.png" },
  { id: 103, name: "Urban Graffiti", price: 4.0, url: "https://cdn-icons-png.flaticon.com/512/3665/3665917.png" },
  { id: 104, name: "Abstract Art", price: 6.0, url: "https://cdn-icons-png.flaticon.com/512/3220/3220672.png" },
];

const Customization = () => {
  // State
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [selectedColor, setSelectedColor] = useState(PRODUCTS[0].colors[0]);
  const [layers, setLayers] = useState([]); // Array of { id, type, content, x, y, width, height, price }
  const [activeTab, setActiveTab] = useState("product"); // product, upload, premium, text
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const printAreaRef = useRef(null);

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newLayer = {
          id: Date.now(),
          type: "image",
          content: event.target.result,
          x: 100, // Centerish
          y: 100,
          width: 150,
          height: 150,
          price: 0, // User uploads are usually free or base printing cost
        };
        setLayers([...layers, newLayer]);
        setSelectedLayerId(newLayer.id);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Premium Asset
  const addPremiumAsset = (asset) => {
    const newLayer = {
      id: Date.now(),
      type: "image",
      content: asset.url,
      x: 100,
      y: 100,
      width: 120,
      height: 120,
      price: asset.price,
      isPremium: true,
      name: asset.name,
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  // Delete Layer
  const deleteLayer = (id) => {
    setLayers(layers.filter((l) => l.id !== id));
    setSelectedLayerId(null);
  };

  // Calculate Total Price
  const totalPrice =
    selectedProduct.basePrice + layers.reduce((acc, layer) => acc + (layer.price || 0), 0);

  // --- STYLES ---
  const theme = {
    bg: "#121212",
    panelBg: "#1E1E1E",
    accent: "#F59E0B", // Gold/Orange
    textMain: "#E4E4E7",
    textMuted: "#A1A1AA",
    border: "#333333",
  };

  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: theme.bg,
      color: theme.textMain,
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', sans-serif",
    },
    header: {
      padding: "1rem 2rem",
      borderBottom: `1px solid ${theme.border}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.panelBg,
    },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: window.innerWidth < 768 ? "column" : "row",
      height: window.innerWidth < 768 ? "auto" : "calc(100vh - 70px)", // Adjust for header
    },
    // Left Side: Canvas
    canvasArea: {
      flex: 2,
      position: "relative",
      backgroundColor: "#000",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      padding: "2rem",
    },
    productImageContainer: {
      position: "relative",
      width: "500px", // Fixed width for consistent positioning context
      height: "600px",
      backgroundImage: `url(${selectedColor.image})`,
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    },
    // The "Printable" Area on the shirt
    printArea: {
      position: "absolute",
      top: "20%",
      left: "25%",
      width: "50%",
      height: "55%",
      border: "1px dashed rgba(255, 255, 255, 0.2)", // Guide line
      overflow: "hidden", // Clip designs to this box
      },
    // Right Side: Tools
    toolsPanel: {
      flex: 1,
      minWidth: "350px",
      maxWidth: window.innerWidth < 768 ? "100%" : "400px",
      backgroundColor: theme.panelBg,
      borderLeft: `1px solid ${theme.border}`,
      display: "flex",
      flexDirection: "column",
    },
    tabs: {
      display: "flex",
      borderBottom: `1px solid ${theme.border}`,
    },
    tabBtn: (isActive) => ({
      flex: 1,
      padding: "1rem",
      backgroundColor: isActive ? "rgba(245, 158, 11, 0.1)" : "transparent",
      color: isActive ? theme.accent : theme.textMuted,
      border: "none",
      borderBottom: isActive ? `2px solid ${theme.accent}` : "2px solid transparent",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "5px",
      fontSize: "0.8rem",
      transition: "all 0.2s",
    }),
    tabContent: {
      flex: 1,
      padding: "1.5rem",
      overflowY: "auto",
    },
    // Generic UI Elements
    sectionTitle: {
      fontSize: "1rem",
      fontWeight: "600",
      marginBottom: "1rem",
      color: theme.textMain,
    },
    colorDot: (hex, isSelected) => ({
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      backgroundColor: hex,
      border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
      cursor: "pointer",
      position: "relative",
      outline: isSelected ? "2px solid rgba(245, 158, 11, 0.3)" : "none",
      outlineOffset: "2px",
    }),
    uploadBox: {
      border: `2px dashed ${theme.border}`,
      borderRadius: "12px",
      padding: "2rem",
      textAlign: "center",
      cursor: "pointer",
      color: theme.textMuted,
      transition: "border-color 0.2s",
      ":hover": { borderColor: theme.accent },
    },
    assetGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "1rem",
    },
    assetCard: {
      backgroundColor: theme.bg,
      border: `1px solid ${theme.border}`,
      borderRadius: "8px",
      padding: "0.8rem",
      cursor: "pointer",
      transition: "transform 0.2s",
      textAlign: "center",
    },
    assetImg: {
      width: "100%",
      height: "80px",
      objectFit: "contain",
      marginBottom: "0.5rem",
    },
    layerRow: (isSelected) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.8rem",
      backgroundColor: isSelected ? "rgba(245, 158, 11, 0.1)" : theme.bg,
      borderRadius: "8px",
      marginBottom: "0.5rem",
      border: isSelected ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`,
      cursor: "pointer",
    }),
    footer: {
      padding: "1.5rem",
      borderTop: `1px solid ${theme.border}`,
      backgroundColor: "#151515",
    },
    totalPrice: {
      fontSize: "1.5rem",
      fontWeight: "700",
      color: theme.accent,
    },
    addToCartBtn: {
      width: "100%",
      padding: "1rem",
      backgroundColor: theme.accent,
      color: "#000",
      border: "none",
      borderRadius: "8px",
      fontWeight: "700",
      fontSize: "1rem",
      cursor: "pointer",
      marginTop: "1rem",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "0.5rem",
      boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)",
    },
  };

  const DraggableResizable = ({ layer, selected, onChange }) => {
    const elRef = useRef(null);
    const aspect = (Number(layer.width) || 1) / (Number(layer.height) || 1);
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const start = useRef({ x: 0, y: 0, lx: 0, ly: 0, w: 0, h: 0 });

    useEffect(() => {
      const onMove = (e) => {
        if (!printAreaRef.current) return;
        const rect = printAreaRef.current.getBoundingClientRect();
        if (dragging) {
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          let nx = start.current.lx + dx;
          let ny = start.current.ly + dy;
          nx = Math.max(0, Math.min(nx, rect.width - start.current.w));
          ny = Math.max(0, Math.min(ny, rect.height - start.current.h));
          onChange({ ...layer, x: Math.round(nx), y: Math.round(ny) });
        } else if (resizing) {
          const dx = e.clientX - start.current.x;
          let newW = Math.max(30, Math.min(start.current.w + dx, rect.width - start.current.lx));
          let newH = Math.round(newW / aspect);
          if (start.current.ly + newH > rect.height) {
            newH = rect.height - start.current.ly;
            newW = Math.round(newH * aspect);
          }
          onChange({ ...layer, width: newW, height: newH });
        }
      };
      const onUp = () => { setDragging(false); setResizing(false); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }, [dragging, resizing, aspect, layer, onChange]);

    const onMouseDownDrag = (e) => {
      e.preventDefault();
      start.current.x = e.clientX;
      start.current.y = e.clientY;
      start.current.lx = Number(layer.x) || 0;
      start.current.ly = Number(layer.y) || 0;
      start.current.w = Number(layer.width) || 0;
      start.current.h = Number(layer.height) || 0;
      setDragging(true);
    };

    const onMouseDownResize = (e) => {
      e.stopPropagation();
      e.preventDefault();
      start.current.x = e.clientX;
      start.current.y = e.clientY;
      start.current.lx = Number(layer.x) || 0;
      start.current.ly = Number(layer.y) || 0;
      start.current.w = Number(layer.width) || 0;
      start.current.h = Number(layer.height) || 0;
      setResizing(true);
    };

    return (
      <div
        ref={elRef}
        style={{
          position: 'absolute',
          left: Number(layer.x) || 0,
          top: Number(layer.y) || 0,
          width: Number(layer.width) || 0,
          height: Number(layer.height) || 0,
          border: selected ? `2px solid ${theme.accent}` : 'none',
          cursor: 'move',
          boxSizing: 'border-box'
        }}
        onMouseDown={onMouseDownDrag}
        onClick={() => setSelectedLayerId(layer.id)}
      >
        {layer.type === 'image' && (
          <img src={layer.content} alt="design" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
        )}
        <div
          onMouseDown={onMouseDownResize}
          style={{
            position: 'absolute',
            right: -8,
            bottom: -8,
            width: 16,
            height: 16,
            background: selected ? theme.accent : '#888',
            borderRadius: 4,
            cursor: 'nwse-resize'
          }}
        />
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* --- HEADER --- */}
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button style={{ background: "none", border: "none", color: theme.textMain, cursor: "pointer" }}>
            <FiChevronLeft size={24} />
          </button>
          <h1 style={{ fontSize: "1.2rem", margin: 0 }}>Studio <span style={{ color: theme.accent }}>Creator</span></h1>
        </div>
        <button style={{ background: "none", border: `1px solid ${theme.border}`, color: theme.textMuted, padding: "8px 16px", borderRadius: "20px", display: "flex", gap: "8px", alignItems: "center", cursor: "pointer" }}>
          <FiShare2 /> Share Design
        </button>
      </header>

      <div style={styles.main}>
        {/* --- LEFT: CANVAS AREA --- */}
        <div style={styles.canvasArea}>
          <div style={styles.productImageContainer}>
            {/* The Safe Print Area */}
            <div style={styles.printArea} ref={printAreaRef}>
              {layers.map((layer) => (
                <DraggableResizable
                  key={layer.id}
                  layer={layer}
                  selected={selectedLayerId === layer.id}
                  onChange={(updated) => {
                    setLayers((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
                    setSelectedLayerId(layer.id);
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Zoom/Reset Controls (Visual only for this demo) */}
          <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: theme.panelBg, padding: "8px", borderRadius: "30px", display: "flex", gap: "10px", border: `1px solid ${theme.border}` }}>
             <button style={{background:'none', border:'none', color: theme.textMain, cursor:'pointer'}}>-</button>
             <span style={{fontSize:'0.8rem'}}>100%</span>
             <button style={{background:'none', border:'none', color: theme.textMain, cursor:'pointer'}}>+</button>
          </div>
        </div>

        {/* --- RIGHT: TOOLS PANEL --- */}
        <div style={styles.toolsPanel}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {[
              { id: "product", icon: <FiShoppingBag />, label: "Product" },
              { id: "upload", icon: <FiUpload />, label: "Upload" },
              { id: "premium", icon: <FiGrid />, label: "Designs" },
              { id: "layers", icon: <FiLayers />, label: "Layers" },
            ].map((tab) => (
              <button
                key={tab.id}
                style={styles.tabBtn(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            
            {/* 1. PRODUCT TAB */}
            {activeTab === "product" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={styles.sectionTitle}>Choose Base Product</h3>
                <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
                  {PRODUCTS.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => { setSelectedProduct(prod); setSelectedColor(prod.colors[0]); }}
                      style={{
                        padding: "10px",
                        border: selectedProduct.id === prod.id ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: theme.bg,
                        flex: 1,
                        textAlign:'center',
                        fontSize: '0.9rem'
                      }}
                    >
                      {prod.name}
                    </div>
                  ))}
                </div>

                <h3 style={styles.sectionTitle}>Select Color</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {selectedProduct.colors.map((color) => (
                    <div
                      key={color.name}
                      style={styles.colorDot(color.hex, selectedColor.name === color.name)}
                      onClick={() => setSelectedColor(color)}
                      title={color.name}
                    >
                      {selectedColor.name === color.name && (
                        <FiCheck style={{ position: "absolute", top: "6px", left: "6px", color: color.name === "White" ? "#000" : "#fff" }} />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 2. UPLOAD TAB */}
            {activeTab === "upload" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={styles.sectionTitle}>Upload Your Art</h3>
                <label style={styles.uploadBox}>
                  <input type="file" accept="image/*" hidden onChange={handleFileUpload} />
                  <FiUpload size={32} style={{ marginBottom: "10px", color: theme.accent }} />
                  <p>Click to upload image</p>
                  <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
                    Supported: PNG, JPG, WEBP
                  </span>
                </label>
                <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: theme.textMuted, lineHeight: "1.5" }}>
                  * Please ensure you own the rights to the uploaded image. High-resolution transparent PNGs work best.
                </div>
              </motion.div>
            )}

            {/* 3. PREMIUM DESIGNS TAB */}
            {activeTab === "premium" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={styles.sectionTitle}>Premium Assets</h3>
                <div style={styles.assetGrid}>
                  {PREMIUM_ASSETS.map((asset) => (
                    <div
                      key={asset.id}
                      style={styles.assetCard}
                      onClick={() => addPremiumAsset(asset)}
                    >
                      <img src={asset.url} alt={asset.name} style={styles.assetImg} />
                      <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>{asset.name}</div>
                      <div style={{ color: theme.accent, fontSize: "0.8rem", marginTop: "4px" }}>
                        +${asset.price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 4. LAYERS TAB */}
            {activeTab === "layers" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 style={styles.sectionTitle}>Manage Layers</h3>
                {layers.length === 0 ? (
                  <p style={{ color: theme.textMuted, textAlign: "center", marginTop: "2rem" }}>
                    No layers added yet.
                  </p>
                ) : (
                  layers.map((layer, index) => (
                    <div
                      key={layer.id}
                      style={styles.layerRow(selectedLayerId === layer.id)}
                      onClick={() => setSelectedLayerId(layer.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img
                          src={layer.content}
                          alt="layer"
                          style={{ width: "30px", height: "30px", objectFit: "cover", borderRadius: "4px", backgroundColor: "#fff" }}
                        />
                        <div>
                          <div style={{ fontSize: "0.9rem" }}>{layer.isPremium ? layer.name : `Upload ${index + 1}`}</div>
                          {layer.price > 0 && <div style={{ fontSize: "0.7rem", color: theme.accent }}>${layer.price}</div>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLayer(layer.id);
                        }}
                        style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </div>

          {/* Footer Summary */}
          <div style={styles.footer}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ color: theme.textMuted }}>Base Price:</span>
              <span>${selectedProduct.basePrice.toFixed(2)}</span>
            </div>
            {layers.filter(l => l.price > 0).length > 0 && (
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ color: theme.textMuted }}>Customizations:</span>
                <span>+${layers.reduce((acc, l) => acc + (l.price || 0), 0).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.border}`, paddingTop: "1rem", marginTop: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: "600" }}>Total:</span>
              <span style={styles.totalPrice}>${totalPrice.toFixed(2)}</span>
            </div>
            
            <button 
              style={styles.addToCartBtn}
              onClick={() => alert(`Order Placed!\nProduct: ${selectedProduct.name} (${selectedColor.name})\nTotal: $${totalPrice}`)}
            >
              <FiShoppingBag /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Customization;
