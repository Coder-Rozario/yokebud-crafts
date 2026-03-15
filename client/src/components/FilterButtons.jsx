import { useEffect } from 'react';
import '../pages/styles/FilterButtons.scss';

const FilterButtons = ({ onFilter }) => {
  useEffect(() => {
    const handleButtonClick = (e) => {
      if (e.target.classList.contains('filter_btn')) {
        const filterType = e.target.id;
        onFilter(filterType);
      }
    };

    document.addEventListener('click', handleButtonClick);
    return () => document.removeEventListener('click', handleButtonClick);
  }, [onFilter]);

  return null;
};

export default FilterButtons;