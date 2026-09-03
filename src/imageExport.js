import { showToast } from "./utils.js";

// 후보 카드를 이미지(PNG)로 캡처해 다운로드한다. 편집취소·이전 후보·다음 후보·저장 버튼이 모인
// actions 영역은 스크린샷에 의미가 없으므로 ignoreElements로 제외한다.
export async function saveCandidateCardAsImage(cardEl, title) {
  if (typeof html2canvas !== "function") {
    showToast("이미지 저장 기능을 불러오지 못했습니다.", "error");
    return;
  }
  // 좁은 모바일 화면에서는 요일별 그리드(.grid-scroll)가 화면 폭보다 넓어 가로 스크롤이
  // 걸리는데, html2canvas는 스크롤로 가려진 부분을 그리지 못해 화·수 등 뒤쪽 요일이 잘려
  // 저장된다. 캡처 전 실제로 필요한 전체 폭을 원본 DOM에서 측정해 두고, 캡처용 복제
  // 문서에서만 카드 폭을 그만큼 넓혀 스크롤 없이 월~토 전체가 한 번에 담기게 한다.
  const gridWrap = cardEl.querySelector(".grid-scroll");
  const neededWidth = gridWrap
    ? cardEl.offsetWidth +
      Math.max(0, gridWrap.scrollWidth - gridWrap.clientWidth)
    : null;
  const CAPTURE_ATTR = "data-capture-card";
  cardEl.setAttribute(CAPTURE_ATTR, "");
  try {
    const canvas = await html2canvas(cardEl, {
      backgroundColor: "#ffffff",
      scale: 2,
      ignoreElements: (el) =>
        el.classList && el.classList.contains("candidate-card-actions"),
      // html2canvas가 repeating-linear-gradient 배경을 그리지 못하고 흰 배경으로 남기는 문제가
      // 있어(이동 시간 블록·제외 회원 블록에 사용 중), 캡처용 복제 문서에서만 무늬를 대표하는
      // 단색으로 바꿔치기한다. 화면에 실제로 보이는 원본 요소는 건드리지 않는다.
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll(".cal-travel-block").forEach((el) => {
          el.style.background = "#ffedd5";
        });
        clonedDoc.querySelectorAll(".cal-block.excluded").forEach((el) => {
          el.style.background = "#e5e7eb";
        });
        if (neededWidth) {
          const clonedCard = clonedDoc.querySelector(`[${CAPTURE_ATTR}]`);
          if (clonedCard) {
            clonedCard.style.width = neededWidth + "px";
            clonedCard.style.maxWidth = "none";
          }
          clonedDoc.querySelectorAll(".grid-scroll").forEach((el) => {
            el.style.overflow = "visible";
          });
        }
      },
    });
    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast("이미지 저장에 실패했습니다.", "error");
        return;
      }
      const dateLabel = new Date().toISOString().slice(0, 10);
      const filename =
        title.replace(/[\\/:*?"<>|]/g, "") + "_" + dateLabel + ".png";

      // 아이폰 Safari는 <a download>로 저장하면 "사진" 앱이 아닌 "파일" 앱으로 저장된다.
      // navigator.share로 이미지를 공유하면 공유 시트에 "이미지 저장" 항목이 뜨고,
      // 이를 선택하면 사진 앱에 저장된다. PC 브라우저도 Web Share API를 지원하는 경우가 있어
      // 모바일 기기에서만 공유 시트를 쓰고, PC에서는 바로 다운로드되게 한다.
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const file = new File([blob], filename, { type: "image/png" });
      if (
        isMobile &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return; // 사용자가 공유 취소
          // 공유 실패 시 아래 다운로드 방식으로 대체
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("후보를 이미지로 저장했습니다", "success");
    }, "image/png");
  } catch (err) {
    showToast("이미지 저장에 실패했습니다.", "error");
  } finally {
    cardEl.removeAttribute(CAPTURE_ATTR);
  }
}
