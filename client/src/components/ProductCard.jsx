// import React, { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { FiHeart, FiStar, FiShoppingCart, FiPlus, FiMinus, FiCheck } from 'react-icons/fi';
// import { useCart } from '../pages/context/CartContext';
// import { useLocale } from '../pages/context/LocaleContext';

// const ProductCard = ({ product, onClick }) => {
//   // State for the card functionality
//   const [isHovered, setIsHovered] = useState(false);
//   const [showAddToCart, setShowAddToCart] = useState(false);
//   const [quantity, setQuantity] = useState(product.moq || 1);
//   const [isFavorite, setIsFavorite] = useState(false);
//   const [showNotification, setShowNotification] = useState(false);
  
//   const { addToCart } = useCart();
//   const { format } = useLocale();

//   const handleAddToCart = (e) => {
//     e.stopPropagation();
//     addToCart(product, quantity);
//     setShowAddToCart(false);
//     setShowNotification(true);
//   };

//   const toggleFavorite = (e) => {
//     e.stopPropagation();
//     setIsFavorite(!isFavorite);
//   };

//   useEffect(() => {
//     if (showNotification) {
//       const timer = setTimeout(() => {
//         setShowNotification(false);
//       }, 3000);
//       return () => clearTimeout(timer);
//     }
//   }, [showNotification]);

//   return (
//     <>
//       {/* Product Card */}
//       <motion.div 
//         className="product-card"
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.5, ease: "easeOut" }}
//         whileHover={{ 
//           scale: 1.03, 
//           boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
//           transition: { duration: 0.3, ease: "easeInOut" }
//         }}
//         onClick={onClick}
//         onMouseEnter={() => setIsHovered(true)}
//         onMouseLeave={() => {
//           setIsHovered(false);
//           setShowAddToCart(false);
//         }}
//         style={{
//           background: '#1a1a1a',
//           borderRadius: '12px',
//           overflow: 'hidden',
//           boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
//           cursor: 'pointer',
//           position: 'relative',
//           border: '1px solid #333',
//           height: '100%',
//           display: 'flex',
//           flexDirection: 'column',
//           minWidth: 'calc(50% - 16px)',
//           flex: '1 1 calc(50% - 16px)',
//           margin: '8px'
//         }}
//       >
//         {/* Product Tags */}
//         <div style={{
//           position: 'absolute',
//           top: '12px',
//           left: '12px',
//           display: 'flex',
//           gap: '8px',
//           zIndex: 2,
//           flexWrap: 'wrap',
//           maxWidth: 'calc(100% - 24px)'
//         }}>
//           {product.tags?.map((tag, index) => (
//             <div key={index} style={{
//               padding: '4px 8px',
//               background: 
//                 tag === 'NEW' ? 'linear-gradient(90deg, #6dd5fa, #3498db)' :
//                 tag === 'SALE' ? 'linear-gradient(90deg, #ff6a6a, #e74c3c)' :
//                 tag === 'BESTSELLER' ? 'linear-gradient(90deg, #f9d423, #f39c12)' :
//                 tag === 'LIMITED' ? 'linear-gradient(90deg, #bc83e6, #9b59b6)' :
//                 'linear-gradient(90deg, #4b6cb7, #2c3e50)',
//               borderRadius: '4px',
//               fontSize: '12px',
//               fontWeight: '700',
//               color: '#fff',
//               textTransform: 'uppercase',
//               letterSpacing: '0.5px',
//               display: 'inline-block',
//               whiteSpace: 'nowrap'
//             }}>
//               {tag}
//             </div>
//           ))}
//         </div>
        
//         {/* Product Image Container */}
//         <div style={{
//           position: 'relative',
//           width: '100%',
//           height: '0',
//           paddingBottom: '100%',
//           overflow: 'hidden',
//           flexShrink: 0,
//           backgroundColor: '#000'
//         }}>
//           <motion.img 
//             src={product.product_photos?.[0] || ''} 
//             alt={product.product_name}
//             initial={{ scale: 1 }}
//             animate={{ scale: isHovered ? 1.05 : 1 }}
//             transition={{ duration: 0.5, ease: "easeInOut" }}
//             style={{
//               position: 'absolute',
//               top: 0,
//               left: 0,
//               width: '100%',
//               height: '100%',
//               objectFit: 'cover',
//               objectPosition: 'center'
//             }}
//           />
          
//           {/* Wishlist Button */}
//           <motion.div
//             whileTap={{ scale: 0.9 }}
//             onClick={toggleFavorite}
//             style={{
//               position: 'absolute',
//               top: '12px',
//               right: '12px',
//               background: 'rgba(0,0,0,0.7)',
//               borderRadius: '50%',
//               width: '36px',
//               height: '36px',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
//               zIndex: 2,
//               cursor: 'pointer'
//             }}
//           >
//             <FiHeart style={{ 
//               color: isFavorite ? '#FFD700' : 'white', 
//               fontSize: '18px',
//               transition: 'color 0.3s ease',
//               fill: isFavorite ? '#FFD700' : 'transparent'
//             }} />
//           </motion.div>
          
//           {/* Add to Cart Overlay */}
//           {isHovered && (
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: 20 }}
//               transition={{ duration: 0.3, ease: "easeInOut" }}
//               style={{
//                 position: 'absolute',
//                 bottom: 0,
//                 left: 0,
//                 right: 0,
//                 background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
//                 padding: '16px',
//                 zIndex: 1
//               }}
//             >
//               {showAddToCart ? (
//                 <motion.div
//                   initial={{ opacity: 0, scale: 0.9 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                   transition={{ type: 'spring', stiffness: 400, damping: 20 }}
//                   style={{
//                     display: 'flex',
//                     flexDirection: 'column',
//                     gap: '8px'
//                   }}
//                 >
//                   <div style={{
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'space-between',
//                     background: 'rgba(255,255,255,0.1)',
//                     borderRadius: '6px',
//                     overflow: 'hidden',
//                     border: '1px solid rgba(255,255,255,0.1)'
//                   }}>
//                     <motion.button
//                       whileTap={{ scale: 0.9 }}
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setQuantity(prev => Math.max(product.moq || 1, prev - 1));
//                       }}
//                       style={{
//                         width: '36px',
//                         height: '36px',
//                         background: 'rgba(255,255,255,0.1)',
//                         border: 'none',
//                         color: '#fff',
//                         fontSize: '16px',
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'center',
//                         cursor: 'pointer'
//                       }}
//                     >
//                       <FiMinus />
//                     </motion.button>
                    
//                     <span style={{
//                       color: '#fff',
//                       fontWeight: '600',
//                       fontSize: '14px'
//                     }}>
//                       {quantity}
//                     </span>
                    
//                     <motion.button
//                       whileTap={{ scale: 0.9 }}
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setQuantity(prev => prev + 1);
//                       }}
//                       style={{
//                         width: '36px',
//                         height: '36px',
//                         background: 'rgba(255,255,255,0.1)',
//                         border: 'none',
//                         color: '#fff',
//                         fontSize: '16px',
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'center',
//                         cursor: 'pointer'
//                       }}
//                     >
//                       <FiPlus />
//                     </motion.button>
//                   </div>
                  
//                   <motion.button
//                     whileHover={{ 
//                       background: 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00)',
//                       boxShadow: '0 4px 20px rgba(255, 215, 0, 0.6)',
//                       transition: { duration: 0.3 }
//                     }}
//                     whileTap={{ scale: 0.95 }}
//                     onClick={handleAddToCart}
//                     style={{
//                       width: '100%',
//                       padding: '12px',
//                       background: 'linear-gradient(90deg, #FFC600, #FF8C00)',
//                       color: '#111',
//                       border: 'none',
//                       borderRadius: '6px',
//                       fontSize: '14px',
//                       fontWeight: '700',
//                       cursor: 'pointer',
//                       display: 'flex',
//                       alignItems: 'center',
//                       justifyContent: 'center',
//                       gap: '8px',
//                       transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
//                     }}
//                   >
//                     <FiShoppingCart />
//                     Add ({format((product.discounted_price || product.price) * quantity)})
//                   </motion.button>
//                 </motion.div>
//               ) : (
//                 <motion.button
//                   initial={{ opacity: 0, y: 10 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   transition={{ delay: 0.1, duration: 0.3 }}
//                   whileHover={{ 
//                     background: 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00)',
//                     boxShadow: '0 4px 20px rgba(255, 215, 0, 0.6)',
//                     transition: { duration: 0.3 }
//                   }}
//                   whileTap={{ scale: 0.95 }}
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     setShowAddToCart(true);
//                   }}
//                   style={{
//                     width: '100%',
//                     padding: '12px',
//                     background: 'linear-gradient(90deg, #FFC600, #FF8C00)',
//                     color: '#111',
//                     border: 'none',
//                     borderRadius: '6px',
//                     fontSize: '14px',
//                     fontWeight: '700',
//                     cursor: 'pointer',
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'center',
//                     gap: '8px',
//                     transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
//                   }}
//                 >
//                   <FiShoppingCart />
//                   Add to Cart
//                 </motion.button>
//               )}
//             </motion.div>
//           )}
//         </div>
        
//         {/* Product Info */}
//         <div style={{
//           padding: '16px',
//           display: 'flex',
//           flexDirection: 'column',
//           flexGrow: 1
//         }}>
//           <h3 style={{
//             margin: '0 0 8px 0',
//             fontSize: '16px',
//             fontWeight: '600',
//             color: '#fff',
//             whiteSpace: 'nowrap',
//             overflow: 'hidden',
//             textOverflow: 'ellipsis'
//           }}>{product.product_name}</h3>
          
//           <div style={{
//             display: 'flex',
//             justifyContent: 'space-between',
//             alignItems: 'center',
//             marginBottom: '8px'
//           }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//               {product.discounted_price ? (
//                 <>
//                   <span style={{
//                     fontSize: '18px',
//                     fontWeight: '700',
//                     background: 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00)',
//                     WebkitBackgroundClip: 'text',
//                     WebkitTextFillColor: 'transparent',
//                     display: 'inline-block'
//                   }}>
//                     {format(product.discounted_price)}
//                   </span>
//                   <span style={{
//                     fontSize: '14px',
//                     fontWeight: '500',
//                     color: 'rgb(206, 201, 201)',
//                     textDecoration: 'line-through'
//                   }}>{format(product.price)}</span>
//                 </>
//               ) : (
//                 <span style={{
//                   fontSize: '18px',
//                   fontWeight: '700',
//                   color: '#fff'
//                   }}>{format(product.price)}</span>
//               )}
//             </div>
            
//             <div style={{
//               display: 'flex',
//               alignItems: 'center',
//               gap: '4px'
//             }}>
//               <FiStar style={{ color: '#f1c40f', fontSize: '14px' }} />
//               <span style={{ 
//                 fontSize: '14px', 
//                 color: '#fff'
//               }}>{product.rating}</span>
//               <span style={{ 
//                 fontSize: '12px', 
//                 color: '#95a5a6'
//               }}>({product.reviews})</span>
//             </div>
//           </div>
          
//           {/* Category Section */}
//           <div style={{
//             display: 'flex',
//             justifyContent: 'space-between',
//             alignItems: 'center',
//             marginBottom: '12px'
//           }}>
//             <div style={{
//               display: 'flex',
//               alignItems: 'center',
//               gap: '6px'
//             }}>
//               <span style={{
//                 fontSize: '12px',
//                 color: '#7f8c8d',
//                 textTransform: 'uppercase',
//                 fontWeight: '600'
//               }}>
//                 {product.category}
//               </span>
//               {product.subcategory && (
//                 <span style={{
//                   fontSize: '12px',
//                   color: '#95a5a6'
//                 }}>
//                   / {product.subcategory}
//                 </span>
//               )}
//             </div>
            
//             <span style={{
//               fontSize: '12px',
//               color: product.stock > 20 ? '#2ecc71' : '#e74c3c',
//               fontWeight: '500'
//             }}>
//               {product.stock > 20 ? 'Castomize' : 'Low Stock'}
//             </span>
//           </div>
          
//           <div style={{
//             display: 'flex',
//             justifyContent: 'space-between',
//             alignItems: 'center',
//             marginTop: 'auto'
//           }}>
//             <div style={{
//               padding: '4px 8px',
//               background: '#333',
//               borderRadius: '4px',
//               fontSize: '12px',
//               fontWeight: '500',
//               color: '#fff'
//             }}>
//               MOQ: {product.moq || 1}
//             </div>
            
//             <span style={{
//               fontSize: '12px',
//               color: '#95a5a6',
//               fontStyle: 'italic'
//             }}>
//               {product.shipping}
//             </span>
//           </div>
//         </div>
//       </motion.div>

//       {/* Notification */}
//       <AnimatePresence>
//         {showNotification && (
//           <motion.div
//             initial={{ opacity: 0, y: 50, x: '-50%' }}
//             animate={{ opacity: 1, y: 0, x: '-50%' }}
//             exit={{ opacity: 0, y: 50, x: '-50%' }}
//             transition={{ type: 'spring', damping: 25 }}
//             style={{
//               position: 'fixed',
//               left: '50%',
//               bottom: '30px',
//               zIndex: 1000,
//               background: 'rgba(0, 0, 0, 0.9)',
//               backdropFilter: 'blur(10px)',
//               color: 'white',
//               padding: '16px 24px',
//               borderRadius: '12px',
//               boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
//               border: '1px solid rgba(255, 255, 255, 0.1)',
//               display: 'flex',
//               alignItems: 'center',
//               gap: '12px',
//               maxWidth: '90%',
//               width: 'auto'
//             }}
//           >
//             <div style={{
//               background: 'rgba(76, 175, 80, 0.2)',
//               borderRadius: '50%',
//               width: '32px',
//               height: '32px',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               flexShrink: 0
//             }}>
//               <FiCheck style={{ color: '#4CAF50', fontSize: '20px' }} />
//             </div>
//             <div>
//               <div style={{ 
//                 fontWeight: '600',
//                 fontSize: '16px',
//                 marginBottom: '4px'
//               }}>
//                 Added to Cart
//               </div>
//               <div style={{ 
//                 fontSize: '14px',
//                 color: 'rgba(255, 255, 255, 0.8)'
//               }}>
//                 {quantity} × {product.product_name}
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </>
//   );
// };

// export default ProductCard;
