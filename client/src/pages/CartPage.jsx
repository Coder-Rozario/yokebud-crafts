// src/pages/CartPage.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../pages/context/CartContext';
import { 
  FiTrash2, FiArrowRight, FiShoppingBag, 
  FiShield, FiTruck
} from 'react-icons/fi';
import { useLocale } from './context/LocaleContext';

const CartPage = () => {
  const { cartItems, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();
  const { format } = useLocale();

  // --- HELPER: SAFE DATA ACCESS ---
  const getProductData = (item) => {
    return {
        name: item.product_name || item.product?.product_name || "Unknown Product",
        image: item.product_photos?.[0] || item.product?.product_photos?.[0] || item.image || 'https://via.placeholder.com/150',
        category: item.category || item.product?.category || "Apparel",
        price: item.discounted_price || item.price || item.product?.discounted_price || item.product?.price || 0
    };
  };

  // --- CALCULATIONS ---
  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const { price } = getProductData(item);
      return total + (price * item.quantity);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const grandTotal = subtotal;

  const formatPrice = (priceUSD) => {
    return format(priceUSD);
  };

  // --- EMPTY STATE ---
  if (cartItems.length === 0) {
    return (
      <div className="empty-cart-container">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="empty-cart-content"
        >
          <div className="empty-icon-wrapper">
            {/* Icon Color set to Gold Hex to match button */}
            <FiShoppingBag size={50} color="#BF953F" />
          </div>
          <h2>Your Cart is Empty</h2>
          <p>Looks like you haven't made your choice yet.<br/>Discover luxury in our latest collection.</p>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button className="premium-btn">
              Start Shopping
            </button>
          </Link>
        </motion.div>
        
        <style>{`
            .empty-cart-container {
                min-height: 80vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
                color: #fff;
                padding: 20px;
            }
            .empty-cart-content {
                text-align: center;
                max-width: 400px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .empty-icon-wrapper {
                width: 120px;
                height: 120px;
                background: rgba(191, 149, 63, 0.05); /* Low opacity gold bg */
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 25px auto;
                border: 2px solid #BF953F; /* Gold Border */
                box-shadow: 0 0 30px rgba(191, 149, 63, 0.2);
            }
            .empty-cart-content h2 { font-size: 2.2rem; margin-bottom: 15px; font-weight: 300; letter-spacing: 1px; }
            .empty-cart-content p { color: #888; margin-bottom: 35px; line-height: 1.6; font-size: 1.1rem; }
            
            /* UPDATED PREMIUM BUTTON STYLE (Gold Gradient) */
            .premium-btn {
                background: linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C);
                color: #000;
                border: none;
                padding: 16px 40px;
                border-radius: 50px;
                font-size: 1rem;
                font-weight: 700;
                letter-spacing: 1px;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 5px 20px rgba(191, 149, 63, 0.4);
                display: inline-block;
            }
            .premium-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 30px rgba(191, 149, 63, 0.6);
                filter: brightness(1.1);
            }
        `}</style>
      </div>
    );
  }

  // --- MAIN UI ---
  return (
    <div className="cart-page-container">
      <div className="cart-wrapper">
        
        {/* Page Title */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="cart-header-section"
        >
            <h1 className="page-title">Shopping Cart <span className="count-badge">{cartItems.length}</span></h1>
            <button onClick={clearCart} className="clear-link">
               Clear Cart
            </button>
        </motion.div>

        <div className="cart-layout">
          
          {/* --- LEFT COLUMN: ITEMS --- */}
          <div className="cart-items-column">
            
            <AnimatePresence>
              {cartItems.map((item, index) => {
                const { name, image, category, price } = getProductData(item);
                
                return (
                  <motion.div 
                    key={`${item.id}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.1 }}
                    className="cart-item-card"
                  >
                    {/* Image */}
                    <div className="cart-item-image">
                      <img src={image} alt={name} loading="lazy" />
                    </div>

                    {/* Content */}
                    <div className="cart-item-details">
                      <div className="details-top">
                        <div className="info-block">
                           <h3>{name}</h3>
                           <span className="category-tag">{category}</span>
                        </div>
                        <div className="price-block">
                            <span className="current-price">{formatPrice(price * item.quantity)}</span>
                        </div>
                      </div>

                      {/* Selections & Actions */}
                      <div className="details-bottom">
                          <div className="variants-grid">
                             {item.selections?.map((sel, idx) => (
                                <div key={idx} className="variant-pill">
                                    <span className="v-label">Size: {sel.size}</span>
                                    <span className="v-divider">/</span>
                                    <span className="v-label">Color: {sel.color}</span>
                                </div>
                             ))}
                          </div>

                          <div className="actions-row">
                             <div className="qty-control">
                                 <span className="qty-label">Qty: {item.quantity}</span>
                             </div>
                             
                             <button onClick={() => removeFromCart(item.id)} className="remove-text-btn">
                                <FiTrash2 /> Remove
                             </button>
                          </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* --- RIGHT COLUMN: SUMMARY --- */}
          <div className="cart-summary-column">
            <div className="summary-card">
              <h2 className="summary-title">Order Summary</h2>
              
              <div className="cost-row">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="cost-row">
                <span>Shipping Estimate</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="cost-row">
                <span>Tax Estimate</span>
                <span>Calculated at checkout</span>
              </div>

              <div className="divider-line"></div>
              
              <div className="total-row">
                <span>Total</span>
                <span className="grand-total">{formatPrice(grandTotal)}</span>
              </div>

              <button onClick={() => navigate('/checkout')} className="premium-checkout-btn desktop-only">
                Checkout Now <FiArrowRight />
              </button>
              
              <div className="trust-features">
                  <div className="trust-item"><FiShield /> Secure SSL Encryption</div>
                  <div className="trust-item"><FiTruck /> Fast Delivery</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* --- MOBILE STICKY CHECKOUT --- */}
      <div className="mobile-sticky-checkout">
         <div className="mobile-info">
            <span className="label">Total (Incl. Tax)</span>
            <span className="amount">{formatPrice(grandTotal)}</span>
         </div>
         <button onClick={() => navigate('/checkout')} className="premium-checkout-btn mobile-btn">
            Checkout
         </button>
      </div>

      {/* --- STYLES --- */}
      <style>{`
        :root {
            --bg-dark: #050505;
            --card-bg: #111111;
            --border-color: #222;
            --accent: #BF953F;
            --text-main: #fff;
            --text-muted: #888;
        }

        .cart-page-container {
          background-color: var(--bg-dark);
          min-height: 100vh;
          padding: 40px 20px 120px 20px;
          color: var(--text-main);
          font-family: 'Inter', sans-serif;
        }
        .cart-wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Header */
        .cart-header-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border-color);
        }
        .page-title {
            font-size: 2rem;
            font-weight: 400;
            margin: 0;
            letter-spacing: -0.5px;
        }
        .count-badge {
            font-size: 1.2rem;
            color: var(--text-muted);
            margin-left: 10px;
        }
        .clear-link {
            background: none;
            border: none;
            color: #ff4444;
            cursor: pointer;
            font-size: 0.9rem;
            text-decoration: underline;
            opacity: 0.8;
            transition: 0.3s;
        }
        .clear-link:hover { opacity: 1; }

        /* Layout */
        .cart-layout {
          display: grid;
          grid-template-columns: 1.8fr 1.1fr;
          gap: 40px;
        }

        /* Item Card - Premium Style */
        .cart-item-card {
            display: flex;
            gap: 20px;
            background: var(--card-bg);
            padding: 20px;
            border-radius: 16px;
            margin-bottom: 20px;
            border: 1px solid transparent;
            transition: all 0.3s ease;
        }
        .cart-item-card:hover {
            border-color: rgba(191, 149, 63, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .cart-item-image {
            width: 120px;
            height: 140px;
            border-radius: 8px;
            overflow: hidden;
            flex-shrink: 0;
        }
        .cart-item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s;
        }
        .cart-item-card:hover .cart-item-image img { transform: scale(1.05); }

        .cart-item-details { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .details-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .info-block h3 { margin: 0 0 6px 0; font-size: 1.2rem; font-weight: 500; color: #fff; }
        .category-tag { font-size: 0.8rem; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        .current-price { font-size: 1.2rem; color: var(--accent); font-weight: 600; }

        .details-bottom { border-top: 1px solid #222; padding-top: 15px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
        .variants-grid { display: flex; gap: 10px; }
        .variant-pill { font-size: 0.85rem; color: #bbb; background: #1a1a1a; padding: 4px 10px; border-radius: 4px; border: 1px solid #333; }
        .v-divider { margin: 0 6px; color: #444; }

        .actions-row { display: flex; align-items: center; gap: 20px; }
        .qty-label { font-size: 0.9rem; color: #fff; background: #222; padding: 5px 12px; border-radius: 4px; border: 1px solid #333; }
        .remove-text-btn { background: none; border: none; color: #666; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.85rem; transition: 0.3s; }
        .remove-text-btn:hover { color: #ff4444; }

        /* Summary Card */
        .summary-card {
            background: rgba(20, 20, 20, 0.6);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 16px;
            border: 1px solid var(--border-color);
            position: sticky;
            top: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .summary-title { font-size: 1.4rem; margin-bottom: 25px; font-weight: 500; }
        .cost-row { display: flex; justify-content: space-between; margin-bottom: 15px; color: #bbb; font-size: 0.95rem; }
        
        .divider-line { height: 1px; background: #333; margin: 20px 0; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 1.3rem; color: #fff; font-weight: 600; }
        .grand-total { color: var(--accent); font-size: 1.5rem; }

        /* CHECKOUT BUTTON STYLE (Same gold gradient) */
        .premium-checkout-btn {
            background: linear-gradient(to right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C);
            color: #000;
            border: none;
            padding: 16px 30px;
            border-radius: 50px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s ease;
            width: 100%;
            box-shadow: 0 5px 20px rgba(191, 149, 63, 0.2);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .premium-checkout-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(191, 149, 63, 0.4); }

        .trust-features { margin-top: 25px; display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
        .trust-item { font-size: 0.75rem; color: #666; display: flex; align-items: center; gap: 6px; }

        /* Mobile Sticky */
        .mobile-sticky-checkout {
            display: none;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: rgba(10, 10, 10, 0.95);
            backdrop-filter: blur(10px);
            padding: 15px 20px;
            border-top: 1px solid #333;
            z-index: 100;
            align-items: center;
            justify-content: space-between;
        }
        .mobile-info { display: flex; flex-direction: column; }
        .mobile-info .label { font-size: 0.8rem; color: #888; }
        .mobile-info .amount { font-size: 1.3rem; color: var(--accent); font-weight: bold; }
        .mobile-btn { width: auto; padding: 12px 30px; border-radius: 8px; }

        /* Responsive */
        @media (max-width: 968px) {
            .cart-layout { grid-template-columns: 1fr; gap: 20px; }
            .cart-summary-column { display: none; }
            .mobile-sticky-checkout { display: flex; }
            .desktop-only { display: none; }
            .cart-item-card { flex-direction: column; gap: 15px; }
            .cart-item-image { width: 100%; height: 200px; }
            .details-bottom { flex-direction: column; align-items: flex-start; gap: 15px; }
            .actions-row { width: 100%; justify-content: space-between; }
        }
      `}</style>
    </div>
  );
};

export default CartPage;
