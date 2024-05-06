import { Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import LoginForm from './LoginForm'
import App from './App'
import { useEffect, useState } from 'react'
import { AuthService } from './services/auth.service'

const authService = new AuthService()

function AppContextProvider() { // контекст для всего приложения
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [loading, setLoading] = useState(false)
    const [currentUserInfo, setCurrentUserInfo] = useState('')

    function fetchData() { // запрос к сервису аутентификации
        setLoading(true)
        authService.checkSession().then(res => {
            if (res.success) {
                setCurrentUserInfo(res.userInfo)
                setIsLoggedIn(true)
            }
            setLoading(false)
        })
    }

    useEffect(() => {
        fetchData()
    }, [])
    return (
        <>
            {!loading ? ( // данные уже загрузились -> отображаем App или LoginForm в зависимости от isLoggedIn
                isLoggedIn ? (
                    <App currentUserInfo={currentUserInfo} />
                ) : (
                    <LoginForm setCurrentUserInfo={v => setCurrentUserInfo(v)} setIsLoggedIn={() => setIsLoggedIn(true)} />
                )
            ) : ( // данные ещё не загрузились -> отображаем спиннер загрузки
                <>
                    <Spin
                        indicator={<LoadingOutlined style={{ fontSize: 100 }} />}
                        style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    />
                </>
            )}
        </>
    )
}

export default AppContextProvider