<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
/**
 * 네이버 자동입찰 설정 견본 (퍼스트몰 서버 전용)
 * 서버에서 같은 폴더에 autobid_config.php 로 복사한 뒤 값을 채워 주세요.
 * ※ autobid_config.php 는 GitHub·공유 드라이브에 절대 올리지 마세요. (토큰·접속 키 포함)
 */
return [
    // 구글 Apps Script 웹 앱 주소(.../exec)와 연결 토큰 — 마케팅 담당자에게 받음
    'gas_url'   => '',
    'gas_token' => '',

    // 화면(GitHub Pages) 주소 — 여기 등록된 곳에서 온 요청만 받음 (끝에 / 없이)
    'allowed_origins' => [
        'https://lib0913.github.io',
    ],

    // 사람별 접속 키: '이름' => '24자 이상 무작위 문자열'
    // 이름은 구글 시트 변경 기록의 '누가'로 남음. 퇴사·유출 시 그 줄을 지우면 바로 막힘.
    // 키 만드는 법(예): https://www.random.org/strings/ 또는 서버에서 php -r "echo bin2hex(random_bytes(24));"
    'keys' => [
        // '홍길동' => '여기에_48자_무작위_키',
    ],
];
