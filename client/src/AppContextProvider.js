import { Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import LoginForm from './LoginForm'
import App from './App'
import { useEffect, useState } from 'react'
import { AuthService } from './services/auth.service'

const authService = new AuthService()

function AppContextProvider() {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [loading, setLoading] = useState(false)
    const [currentUserInfo, setCurrentUserInfo] = useState('')

    function fetchData() {
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
            {!loading ? (
                isLoggedIn ? (
                    <App currentUserInfo={currentUserInfo} />
                ) : (
                    <LoginForm setCurrentUserInfo={v => setCurrentUserInfo(v)} setIsLoggedIn={() => setIsLoggedIn(true)} />
                )
            ) : (
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