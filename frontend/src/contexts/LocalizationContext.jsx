import React, { createContext, useContext, useState, useEffect } from 'react';

const LocalizationContext = createContext();

export const useLocalization = () => {
  return useContext(LocalizationContext);
};

export const LocalizationProvider = ({ children }) => {
  const [symbol, setSymbol] = useState(localStorage.getItem('fmw_symbol') || '$');
  const [thousandSep, setThousandSep] = useState(localStorage.getItem('fmw_thousand') || '.');
  const [decimalSep, setDecimalSep] = useState(localStorage.getItem('fmw_decimal') || ',');
  const [decimals, setDecimals] = useState(parseInt(localStorage.getItem('fmw_decimals') || '0'));

  useEffect(() => {
    localStorage.setItem('fmw_symbol', symbol);
    localStorage.setItem('fmw_thousand', thousandSep);
    localStorage.setItem('fmw_decimal', decimalSep);
    localStorage.setItem('fmw_decimals', decimals);
  }, [symbol, thousandSep, decimalSep, decimals]);

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '';
    const num = parseFloat(value);
    const fixed = num.toFixed(decimals); 
    let [integerPart, decimalPart] = fixed.split('.');
    
    // Regex para miles
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
    
    const result = decimals > 0 ? `${integerPart}${decimalSep}${decimalPart}` : integerPart;
    return `${symbol} ${result}`;
  };

  const value = {
    symbol, setSymbol,
    thousandSep, setThousandSep,
    decimalSep, setDecimalSep,
    decimals, setDecimals,
    formatCurrency
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};