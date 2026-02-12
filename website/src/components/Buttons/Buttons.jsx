/* eslint-disable react/prop-types */

export const Button = ({ children, className, ...props }) => {
  return (
    <div {...props} className={"btn " + className}>
      {children}

      <div className="hover_shape_wrapper">
        <span className="btn_hover_shape btn_hover_shape-1"></span>
        <span className="btn_hover_shape btn_hover_shape-2"></span>
        <span className="btn_hover_shape btn_hover_shape-3"></span>
      </div>
    </div>
  );
};

export const ToggleButton = ({ checked = false, onToggle }) => {

  return (
    <label className="inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        value=""
        className="sr-only peer"
        checked={checked}
        onChange={(e) =>{ onToggle(e.target.checked)}}
      />
      <div className="relative w-7 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
  );
};

export const RoundedButton = ({ className, onClick, disabled, ...other }) => {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex justify-center items-center px-3 py-1 rounded-large border border-solid border-white/30 text-white hover:outline hover:outline-1 hover:outline-white cursor-pointer ${className}`}
      {...other}
    ></button>
  );
};

export const DefaultButton = ({ className, onClick, ...other }) => {
  return (
    <div
      onClick={onClick}
      className={`flex justify-center items-center border border-solid text-white cursor-pointer ${className}`}
      {...other}
    ></div>
  );
};

export const ExtendedButton = ({ disabled=false, className, ...other }) => {
  return (
    <button
      disabled={disabled}
      className={`flex justify-center items-center px-[9px] py-1.5 rounded-md border border-solid border-transparent text-white cursor-pointer ${className}`}
      {...other}
    ></button>
  );
};

export const CircledButton = ({ className, ...others }) => {
  return (
    <button
      type="button"
      className={`w-3 h-[100%] aspect-square rounded-full bg-[#FFFFFF1A] hover:bg-[#FFFFFF3A] active:bg-gray-normal inline-flex justify-center items-center ${className}`}
      {...others}
    ></button>
  );
};

export const GradientButton = ({ className, selected, ...others }) => {
  return (
    <div className={`p-px ${selected ? "bg-gradient-blue-to-purple" : "bg-[#BBBCBD]"} rounded-3xl`}>
      <button
        type="button"
        className={`${className}`}
        {...others}
      ></button>
    </div>
  );
};