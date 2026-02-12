export const Input1 = ({ className, disabled=false, ...other }) => {
  return (
    <input
      type="text"
      disabled={disabled}
      className={`h-5 py-1 px-1 rounded-[4px] bg-black-bg-input outline-none border-none hover:outline-1 hover:outline hover:outline-gray-500 disabled:bg-gray-dark disabled:placeholder:text-gray-normal flex text-orange placeholder:text-orange ${className}`}
      {...other}
    />
  );
};

export const Input2 = ({ className, ...other }) => {
  return (
    <input
      type="text"
      className={`w-full h-8 py-2 px-2 rounded-[8px] bg-black-bg-input outline-none border-none hover:outline-1 hover:outline hover:outline-gray-500 flex text-xs ${className}`}
      {...other}
    />
  );
};
