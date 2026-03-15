import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [inquiryProduct, setInquiryProduct] = useState(null);

  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCartItems(parsedCart);
        // Calculate total items count and products count
        const totalItems = parsedCart.reduce((sum, item) => sum + item.quantity, 0);
        const totalProducts = parsedCart.length;
        setTotalItemsCount(totalItems);
        setTotalProductsCount(totalProducts);
      }
      
      // Load inquiry product if exists
      const savedInquiryProduct = localStorage.getItem('inquiryCheckoutData');
      if (savedInquiryProduct) {
        setInquiryProduct(JSON.parse(savedInquiryProduct));
      }
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
      // If there's an error, initialize with empty cart
      localStorage.removeItem('cart');
      localStorage.removeItem('inquiryCheckoutData');
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save cart to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('cart', JSON.stringify(cartItems));
        // Update counts whenever cartItems changes
        const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalProducts = cartItems.length;
        setTotalItemsCount(totalItems);
        setTotalProductsCount(totalProducts);
      } catch (error) {
        console.error("Error saving cart to localStorage:", error);
      }
    }
  }, [cartItems, isInitialized]);

  const addToCart = (product, quantity = 1) => {
    const moq = product.moq || 1;
    const desiredAdd = Math.max(quantity, moq);
    const stock = Number(product.stock || 0);

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => 
        item.id === product.id && 
        (!product.selectedSize || item.selectedSize === product.selectedSize)
      );

      const existingQty = existingItem ? Number(existingItem.quantity || 0) : 0;
      let allowedAdd = desiredAdd;
      if (stock > 0) {
        const remaining = Math.max(0, stock - existingQty);
        allowedAdd = Math.min(desiredAdd, remaining);
      }

      if (allowedAdd <= 0) {
        // No stock left for this product/variant; keep cart unchanged
        return prevItems;
      }

      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id && 
          (!product.selectedSize || item.selectedSize === product.selectedSize)
            ? { ...item, quantity: Number(item.quantity || 0) + allowedAdd }
            : item
        );
      }

      return [...prevItems, { 
        id: product.id,
        name: product.product_name,
        price: product.discounted_price || product.price,
        min_price: product.min_price || product.discounted_price || product.price,
        max_price: product.max_price || product.price,
        discounted_price: product.discounted_price,
        image: product.firstImage || (product.product_photos && product.product_photos[0]),
        product_photos: product.product_photos || [],
        quantity: allowedAdd,
        selectedSize: product.selectedSize,
        moq: moq,
        stock: stock,
        sku: product.sku || '',
        material: product.material || '',
        care_instructions: product.care_instructions || '',
        shipping_info: product.shipping_info || '',
        warranty: product.warranty || '',
        bulk_discount: product.bulk_discount || '',
        features: product.features || [],
        product_details: product.product_details || '',
        category: product.category || '',
        is_customizable: product.is_customizable,
        product // Store the complete product object
      }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  const setInquiryCheckoutProduct = (product, priceData, inquiryNumber, inquiryId) => {
    // Store the inquiry product data for checkout
    const inquiryProductData = {
      product,
      priceData,
      inquiryNumber,
      inquiryId
    };
    setInquiryProduct(inquiryProductData);
    
    // Also store in localStorage for persistence
    localStorage.setItem('inquiryCheckoutData', JSON.stringify(inquiryProductData));
  };

  const clearInquiryProduct = () => {
    setInquiryProduct(null);
    localStorage.removeItem('inquiryCheckoutData');
  };

  const updateQuantity = (productId, newQuantity) => {
    setCartItems(prevItems =>
      prevItems.map(item => {
        if (item.id === productId) {
          const minQuantity = Number(item.moq || 1);
          const stock = Number(item.stock || 0);
          let qty = Number(newQuantity || minQuantity);
          if (stock > 0) {
            qty = Math.min(qty, stock);
          }
          return { 
            ...item, 
            quantity: Math.max(qty, minQuantity) 
          };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalProducts = () => {
    return cartItems.length;
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        totalItemsCount, // Total quantity of all items
        totalProductsCount, // Total number of unique products
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalProducts,
        getTotalPrice,
        inquiryProduct,
        setInquiryCheckoutProduct,
        clearInquiryProduct
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
