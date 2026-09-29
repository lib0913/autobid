<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
require_once(APPPATH ."controllers/base/front_base".EXT);

/**
 * 네이버 자동입찰 — GitHub Pages 화면용 중계 (2026-09-29)
 *
 *  화면(GitHub Pages) → 이 중계(사람별 접속 키 확인, 구글 토큰은 서버 설정 파일에만) → 구글 Apps Script 웹 앱
 *
 *  URL
 *   /cus_autobid_api/call?action=...   읽기(GET) / 변경(POST, JSON)
 *   /cus_autobid_api/check             연결 점검 (curl·구글 443·설정 유무만, 비밀 값은 보여 주지 않음)
 *
 *  보안
 *   - 설정(allowed_origins)에 등록된 화면 주소에서 온 요청만 허용 (CORS)
 *   - 헤더 X-Autobid-Key 의 접속 키가 설정(keys)에 있어야 통과, 변경 기록의 '누가' = 키 이름
 *   - 같은 IP에서 10분에 10번 틀리면 10분 잠금
 *   - 허용된 요청 이름(전달본 v3 규칙)만 구글로 전달
 *   - DB·세션 값 사용 없음 (퍼스트몰 데이터와 무관)
 */
class cus_autobid_api extends front_base {

    private $READ  = ['home', 'perf', 'status', 'search', 'keyword', 'attention', 'groups'];
    private $WRITE = ['setManage', 'setGroup', 'setKeywordOn', 'runNow'];
    private $GET_KEYS = ['q', 'limit', 'account', 'group', 'keyword', 'fresh', 'channel', 'days', 'pin', 'offset'];

    public function __construct() {
        parent::__construct();
    }

    private function cfg() {
        $f = BASEPATH . "../custom/".__CUSTOM_CONFIG_SITEID__."/app/config/autobid_config.php";
        if (!is_file($f)) return null;
        $c = include $f;
        return is_array($c) ? $c : null;
    }

    private function out($code, $arr) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo is_string($arr) ? $arr : json_encode($arr, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** CORS: 등록된 화면 주소만. 등록 안 된 곳이면 여기서 끝냄 */
    private function cors($cfg) {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string)$_SERVER['HTTP_ORIGIN'], '/') : '';
        $allowed = array_map(function($o) { return rtrim((string)$o, '/'); }, (array)($cfg['allowed_origins'] ?? []));
        if ($origin === '' || !in_array($origin, $allowed, true)) $this->out(403, ['ok' => false, 'error' => '허용되지 않은 요청입니다']);
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Autobid-Key');
        header('Access-Control-Max-Age: 600');
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    }

    private function lock_file() {
        return rtrim(sys_get_temp_dir(), '/\\') . '/autobid_fail_' . md5((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    }

    /** 접속 키 확인 → 키 이름(사람) 또는 종료 */
    private function check_key($cfg) {
        $lf = $this->lock_file();
        $fails = [];
        if (is_file($lf)) { $fails = json_decode((string)@file_get_contents($lf), true); if (!is_array($fails)) $fails = []; }
        $now = time();
        $fails = array_values(array_filter($fails, function($t) use ($now) { return $now - (int)$t < 600; }));
        if (count($fails) >= 10) $this->out(429, ['ok' => false, 'error' => '접속 키를 여러 번 틀려 10분 동안 막혔습니다']);

        $key = trim((string)($_SERVER['HTTP_X_AUTOBID_KEY'] ?? ''));
        if ($key !== '') {
            foreach ((array)($cfg['keys'] ?? []) as $name => $k) {
                $k = (string)$k;
                if (strlen($k) >= 24 && hash_equals($k, $key)) return (string)$name;
            }
            $fails[] = $now;
            @file_put_contents($lf, json_encode($fails), LOCK_EX);
            usleep(400000);
        }
        $this->out(200, ['ok' => false, 'needKey' => true, 'error' => $key === '' ? '접속 키를 넣어 주세요' : '접속 키가 맞지 않습니다']);
    }

    public function call() {
        $cfg = $this->cfg();
        if (!$cfg) $this->out(503, ['ok' => false, 'error' => '자동입찰 설정 파일이 없습니다']);
        $this->cors($cfg);
        $user = $this->check_key($cfg);

        $url = trim((string)($cfg['gas_url'] ?? ''));
        $token = trim((string)($cfg['gas_token'] ?? ''));
        if ($url === '' || $token === '' || strpos($url, 'https://script.google.com/') !== 0) $this->out(200, ['ok' => false, 'error' => '구글 주소·토큰이 설정되지 않았습니다']);
        if (!function_exists('curl_init')) $this->out(200, ['ok' => false, 'error' => '서버에 PHP curl이 없습니다']);

        $action = isset($_GET['action']) ? (string)$_GET['action'] : '';
        $method = (string)($_SERVER['REQUEST_METHOD'] ?? '');
        @set_time_limit(360);

        if (in_array($action, $this->READ, true) && $method === 'GET') {
            $params = ['action' => $action, 'token' => $token];
            foreach ($this->GET_KEYS as $k) if (isset($_GET[$k])) $params[$k] = (string)$_GET[$k];
            $this->out(200, $this->gas('GET', $url . '?' . http_build_query($params), null));
        }
        if (in_array($action, $this->WRITE, true) && $method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            if (!is_array($body)) $this->out(400, ['ok' => false, 'error' => '요청 형식 오류']);
            $body['action'] = $action;
            $body['token'] = $token;
            $body['user'] = $user;   // 변경 기록의 '누가' = 접속 키 이름 (브라우저가 보낸 값은 무시)
            $this->out(200, $this->gas('POST', $url, json_encode($body, JSON_UNESCAPED_UNICODE)));
        }
        $this->out(400, ['ok' => false, 'error' => '허용되지 않은 요청입니다']);
    }

    /** 구글 웹 앱 호출 (302 따라가기, "지금 실행"은 1분 가까이 걸림) */
    private function gas($method, $url, $json) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 330,
        ]);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($res === false || $code >= 400) return json_encode(['ok' => false, 'error' => '구글 연결 실패 (' . ($err ?: $code) . ')'], JSON_UNESCAPED_UNICODE);
        if (!is_array(json_decode($res, true))) return json_encode(['ok' => false, 'error' => '구글 응답을 읽지 못했습니다'], JSON_UNESCAPED_UNICODE);
        return $res;
    }

    /** 연결 점검: 주소창에서 바로 열어 확인 (비밀 값은 표시하지 않음) */
    public function check() {
        $cfg = $this->cfg();
        $google = '확인 안 함';
        if (function_exists('curl_init')) {
            $ch = curl_init('https://script.google.com/');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_NOBODY => true, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 12]);
            curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $google = $code > 0 ? '연결됨' : '연결 안 됨';
        }
        $this->out(200, [
            'ok' => true,
            'curl' => function_exists('curl_init'),
            'google_443' => $google,
            'config' => $cfg ? '있음' : '없음',
            'google_set' => $cfg && !empty($cfg['gas_url']) && !empty($cfg['gas_token']),
            'origins' => $cfg ? count((array)($cfg['allowed_origins'] ?? [])) : 0,
            'keys' => $cfg ? count((array)($cfg['keys'] ?? [])) : 0,
        ]);
    }
}
