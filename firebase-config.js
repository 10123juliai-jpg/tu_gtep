// TU GTEP 자료실 Firebase 설정
//
// 지금은 config가 null이라 "데모 모드"입니다: 아무 정보나 넣어도 로그인·회원가입이 됩니다.
//
// 실제 회원가입을 쓰려면:
// 1) Firebase 콘솔(https://console.firebase.google.com) → 프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → 웹 앱(</>)
//    → "SDK 설정 및 구성"의 firebaseConfig 값을 아래 config: null 자리에 붙여 넣으세요.
//    (이 값은 공개되어도 괜찮은 값입니다. 실제 보호는 firestore.rules가 합니다.)
// 2) admins에 자료를 올리고 지울 수 있는 관리자 이메일(소문자)을 적으세요. firestore.rules에도 같은 주소를 적습니다.
//
// 예시:
// window.TG_FIREBASE = {
//   config: { apiKey: "AIza...", authDomain: "tu-gtep.firebaseapp.com", projectId: "tu-gtep",
//             storageBucket: "tu-gtep.appspot.com", messagingSenderId: "1234567890", appId: "1:1234567890:web:abcdef" },
//   admins: ["gtep@example.ac.kr"]
// };
window.TG_FIREBASE = {
  config: null,
  admins: [],
  // Firebase 연결 전 임시 관리자 비밀번호의 확인용 값 (tools/set_admin_password.py 로 바꿈)
  demoAdminHash: "3346eaef5ae7a8739506efe715ab8a4e09719fc93e17ff6d8bc77940b540c57c"
};
