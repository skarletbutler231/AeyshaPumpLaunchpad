import { FaQuestion, FaQuestionCircle, FaRegQuestionCircle } from "react-icons/fa";
import TopBar from "../components/TopBar/TopBar";

const Faq = () => {
  const questionAndAnswer = [

  ];
  return (
    <div className="w-screen h-screen flex flex-col max-[1800px]:items-start items-center overflow-auto">
      <div className="flex flex-col mx-6 pt-3 my-3">
        <TopBar noProject={true} title={"FAQ"} />
        <div className="flex flex-col mt-12">
          {questionAndAnswer.map((item) => {
            return (
              <div
                id={item.id}
                key={item.id}
                className="rounded-xl bg-black/20 p-8 border border-solid border-[#06b6d4] shadow-custom"
              >
                <div className="text-3xl text-white text-left mb-8">
                  {item.question}
                </div>
                <div
                  className="text-sm text-white text-left leading-8"
                  dangerouslySetInnerHTML={{ __html: item.answer }}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Faq;
