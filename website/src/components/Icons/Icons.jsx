export const MenuButton = (props) => {
  return (
    <img src="/assets/icon/ic_menu.svg" className="cursor-pointer" width="24" alt="menu_icon" onClick={() => {props.onClick()}} />
  );
};
