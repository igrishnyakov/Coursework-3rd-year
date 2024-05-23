import { Button } from 'antd'
import { LoginOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import {Link, useNavigate} from 'react-router-dom'
import { AuthService } from '../services/auth.service'

const authService = new AuthService()

function Header(props) {
    const navigate = useNavigate()

    function login() {
        navigate('/login')
    }

    function logout() {
        authService.logout().then(() => {
            window.location.href = '/'
            //document.location.reload()
        })
    }

    function goToProfile() {
        navigate('/profile')
    }

    return (
        <>
            <div className='header'>
                <div className='header-nav'>
                    <div className='logo'></div>
                    <Link className='header-link' to={'/'}>
                        Новости
                    </Link>
                    <Link className='header-link' to={'/events'}>
                        Мероприятия
                    </Link>
                    <Link className='header-link' to={'/reports'}>
                        Отчеты
                    </Link>
                    {props.isLoggedIn && (
                        <Link className='header-link' to='/application'>
                            Заявки
                        </Link>
                    )}
                </div>
                {props.isLoggedIn ? (
                    <div style={{ marginRight: 10 }}>
                    <span style={{ fontSize: '14px', marginRight: 15 }}>
                        Привет, {props.currentUserInfo.role === 'org' ? 'организатор' : 'волонтер'} {props.currentUserInfo.first_name}!
                    </span>
                        <Button size='small' onClick={goToProfile} type='text'>
                            Личный кабинет
                            <UserOutlined />
                        </Button>
                        <Button size='small' onClick={logout} type='text'>
                            Выйти
                            <LogoutOutlined />
                        </Button>
                    </div>
                ) : (
                    <div style={{ marginRight: 10 }}>
                        <Button size='small' onClick={login} type='text' className='header-link'>
                            Войти
                            <LoginOutlined />
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}

export default Header