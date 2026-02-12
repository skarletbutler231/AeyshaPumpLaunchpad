/* eslint-disable react/prop-types */
export const Card = (props) => {
    return (
        <div className={`${props.className} w-full card-div px-8 py-2.5`}>
            {props.children}
        </div>
    )
}