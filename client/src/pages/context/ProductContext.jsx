// // src/context/ProductContext.jsx
// import { createContext, useState, useEffect } from 'react';

// const API_BASE_URL = 'https://api.yokebud.fiapi';

// // Create the context
// const ProductContext = createContext();

// // Create the provider component
// const ProductProvider = ({ children }) => {
//   const [products, setProducts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const fetchProducts = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/products`);
//       if (!response.ok) {
//         throw new Error('Failed to fetch products');
//       }
//       const data = await response.json();
//       setProducts(data);
//       setLoading(false);
//     } catch (err) {
//       setError(err.message);
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchProducts();
//   }, []);

//   const createProduct = async (productData) => {
//     try {
//       const formData = new FormData();
//       Object.entries(productData).forEach(([key, value]) => {
//         if (key === 'productPhoto' && value) {
//           formData.append(key, value);
//         } else {
//           formData.append(key, value);
//         }
//       });

//       const response = await fetch(`${API_BASE_URL}/products`, {
//         method: 'POST',
//         credentials: 'include',
//         body: formData
//       });

//       if (!response.ok) {
//         throw new Error('Failed to create product');
//       }

//       await fetchProducts();
//     } catch (error) {
//       throw error;
//     }
//   };

//   const updateProduct = async (id, productData) => {
//     try {
//       const formData = new FormData();
//       Object.entries(productData).forEach(([key, value]) => {
//         if (key === 'productPhoto' && value) {
//           formData.append(key, value);
//         } else {
//           formData.append(key, value);
//         }
//       });

//       const response = await fetch(`${API_BASE_URL}/products/${id}`, {
//         method: 'PUT',
//         credentials: 'include',
//         body: formData
//       });

//       if (!response.ok) {
//         throw new Error('Failed to update product');
//       }

//       await fetchProducts();
//     } catch (error) {
//       throw error;
//     }
//   };

//   const deleteProduct = async (id) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/products/${id}`, {
//         method: 'DELETE',
//         credentials: 'include'
//       });

//       if (!response.ok) {
//         throw new Error('Failed to delete product');
//       }

//       await fetchProducts();
//     } catch (error) {
//       throw error;
//     }
//   };

//   return (
//     <ProductContext.Provider value={{ 
//       products, 
//       loading, 
//       error,
//       createProduct,
//       updateProduct,
//       deleteProduct,
//       refreshProducts: fetchProducts
//     }}>
//       {children}
//     </ProductContext.Provider>
//   );
// };

// // Named exports
// export { ProductContext, ProductProvider };

// // Default export
// export default ProductProvider;

import React from 'react';

const ProductContext = () => {
  return (
    <div>
      
    </div>
  );
};

export default ProductContext;